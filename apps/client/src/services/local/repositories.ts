import type {
  Book,
  BookList,
  BookListItem,
  BookSearchCacheEntry,
  ContentSnapshot,
  Goal,
  PendingBookImport,
  ReadingSession,
} from "@/types";
import type { JournalEntry } from "@/services/api/journal";
import {
  localDriver,
  type LocalBookIdentityRemap,
  type LocalTableName,
  type OutboxCounts,
} from "./driver";
import type {
  LocalEntityStatus,
  LocalRecord,
  OutboxItem,
  ProgressLogPayload,
  ProfilePreferencesPayload,
  SyncEntity,
  SyncOperation,
  SyncState,
} from "@/services/sync/types";

const nowIso = () => new Date().toISOString();

const valuesEqual = (left: unknown, right: unknown) => {
  if (Object.is(left, right)) return true;
  if (
    typeof left === "object" &&
    left !== null &&
    typeof right === "object" &&
    right !== null
  ) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }
  return false;
};

const createUpdatePatch = <T extends { id: string }>(previous: T | null, next: T) => {
  if (!previous) return next;
  return Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) =>
        !["id", "user_id", "created_at"].includes(key) &&
        !valuesEqual((previous as Record<string, unknown>)[key], value),
    ),
  );
};

export const createLocalId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const toLocalRecord = <T>(
  userId: string,
  entity: T & { id: string; updated_at?: string | null; created_at?: string | null; deleted_at?: string | null },
  status: LocalEntityStatus = "synced"
): LocalRecord<T> => ({
  id: entity.id,
  user_id: userId,
  data: entity,
  status: entity.deleted_at ? "deleted" : status,
  updated_at: entity.updated_at || entity.created_at || nowIso(),
  deleted_at: entity.deleted_at ?? null,
  last_synced_at: status === "synced" ? nowIso() : null,
});

const makeOutboxItem = (
  userId: string,
  entity: SyncEntity,
  entityId: string,
  operation: SyncOperation,
  payload: unknown
): OutboxItem => {
  const timestamp = nowIso();
  return {
    id: createLocalId(),
    client_mutation_id: createLocalId(),
    client_entity_id: entityId,
    user_id: userId,
    entity,
    operation,
    payload,
    status: "pending",
    attempt_count: 0,
    last_error: null,
    created_at: timestamp,
    updated_at: timestamp,
    next_attempt_at: null,
  };
};

const createEntityRepo = <T extends { id: string }>(table: LocalTableName, entity: SyncEntity) => ({
  async list(userId: string, options?: { includeDeleted?: boolean }): Promise<T[]> {
    const records = await localDriver.listRecords<T>(table, userId, options);
    return records.map((record) => record.data);
  },

  async listRecords(userId: string, options?: { includeDeleted?: boolean }) {
    return localDriver.listRecords<T>(table, userId, options);
  },

  async get(id: string): Promise<T | null> {
    return (await localDriver.getRecord<T>(table, id))?.data ?? null;
  },

  async upsertRemote(userId: string, item: T & { updated_at?: string | null; created_at?: string | null; deleted_at?: string | null }) {
    await localDriver.upsertRecord(table, toLocalRecord(userId, item, "synced"));
  },

  async upsertRemoteMany(userId: string, items: (T & { updated_at?: string | null; created_at?: string | null; deleted_at?: string | null })[]) {
    await localDriver.upsertRecords(table, items.map((item) => toLocalRecord(userId, item, "synced")));
  },

  async upsertRemoteManyPreservingLocal(
    userId: string,
    items: (T & {
      updated_at?: string | null;
      created_at?: string | null;
      deleted_at?: string | null;
    })[],
  ): Promise<T[]> {
    const resolved: T[] = [];
    const cleanRemoteItems: typeof items = [];

    for (const item of items) {
      const local = await localDriver.getRecord<T>(table, item.id);
      if (local && local.status !== "synced") {
        resolved.push(local.data);
      } else {
        cleanRemoteItems.push(item);
        resolved.push(item);
      }
    }

    if (cleanRemoteItems.length > 0) {
      await localDriver.upsertRecords(
        table,
        cleanRemoteItems.map((item) => toLocalRecord(userId, item, "synced")),
      );
    }
    return resolved;
  },

  async upsertLocal(userId: string, item: T, operation: SyncOperation = "update") {
    const existingRecord =
      operation === "update" ? await localDriver.getRecord<T>(table, item.id) : null;
    const updatedItem = {
      ...item,
      updated_at: (item as T & { updated_at?: string }).updated_at || nowIso(),
    } as T & { updated_at?: string };
    const mutationPayload =
      operation === "update"
        ? createUpdatePatch(existingRecord?.data ?? null, updatedItem)
        : updatedItem;

    await localDriver.commitMutation(
      [
        {
          table,
          record: toLocalRecord(
            userId,
            updatedItem,
            operation === "delete" ? "deleted" : "pending",
          ),
        },
      ],
      makeOutboxItem(userId, entity, item.id, operation, mutationPayload),
    );
    return updatedItem;
  },

  async softDeleteLocal(userId: string, item: T) {
    const deletedAt = nowIso();
    const deletedItem = {
      ...item,
      updated_at: deletedAt,
      deleted_at: deletedAt,
    } as T & { updated_at: string; deleted_at: string };

    await localDriver.commitMutation(
      [{ table, record: toLocalRecord(userId, deletedItem, "deleted") }],
      makeOutboxItem(userId, entity, item.id, "delete", deletedItem),
    );
    return deletedItem;
  },

  async remove(id: string) {
    await localDriver.removeRecord(table, id);
  },

  async restoreDeletedLocal(id: string) {
    const record = await localDriver.getRecord<T>(table, id);
    if (!record) return null;

    const restored = {
      ...record.data,
      deleted_at: null,
      updated_at: nowIso(),
    } as T & { deleted_at?: string | null; updated_at?: string };

    await localDriver.upsertRecord<T>(table, {
      ...record,
      data: restored,
      status: "synced",
      deleted_at: null,
      updated_at: restored.updated_at,
      last_synced_at: record.last_synced_at ?? nowIso(),
    });

    return restored;
  },
});

const baseBooksRepo = createEntityRepo<Book>("books", "books");
const MAX_BOOK_ALIAS_DEPTH = 16;
export const booksRepo = {
  ...baseBooksRepo,
  async resolveIdentity(userId: string, bookId: string) {
    const originalBookId = bookId;
    let currentBookId = bookId;
    const visited = new Set<string>();

    for (let depth = 0; depth < MAX_BOOK_ALIAS_DEPTH; depth += 1) {
      if (visited.has(currentBookId)) return originalBookId;
      visited.add(currentBookId);

      const alias = await localDriver.getSyncState(
        userId,
        `book_alias:${currentBookId}`,
      );
      const nextBookId = alias?.user_id === userId ? alias.cursor?.trim() : null;
      if (!nextBookId) return currentBookId;
      if (nextBookId === currentBookId || visited.has(nextBookId)) {
        return originalBookId;
      }
      currentBookId = nextBookId;
    }

    return currentBookId;
  },
  async remapIdentity(
    userId: string,
    staleBookId: string,
    canonicalBook: Book,
    options: Pick<
      LocalBookIdentityRemap,
      "sourceOutbox" | "requireNoOtherUnsyncedReferences"
    > = {},
  ) {
    const record = await localDriver.remapBookIdentity({
      userId,
      staleBookId,
      canonicalBookRecord: toLocalRecord(userId, canonicalBook, "synced"),
      ...options,
    });
    return record.data as Book;
  },
};
const baseSessionsRepo = createEntityRepo<ReadingSession>("reading_sessions", "reading_sessions");
const baseProgressRepo = createEntityRepo<ProgressLogPayload & { id: string }>(
  "progress_logs",
  "progress_logs"
);
export const sessionsRepo = {
  ...baseSessionsRepo,
  async createPending(userId: string, session: ReadingSession) {
    return baseSessionsRepo.upsertLocal(userId, session, "create");
  },
};
export const progressRepo = {
  ...baseProgressRepo,
  async createPending(userId: string, log: ProgressLogPayload & { id: string }) {
    return baseProgressRepo.upsertLocal(userId, log, "create");
  },
};
export const journalRepo = createEntityRepo<JournalEntry>("journal_entries", "journal_entries");
export const goalsRepo = createEntityRepo<Goal>("goals", "goals");
const baseBookListsRepo = createEntityRepo<BookList>("book_lists", "book_lists");
const baseBookListItemsRepo = createEntityRepo<BookListItem>(
  "book_list_items",
  "book_list_items"
);
export const bookListsRepo = {
  ...baseBookListsRepo,
  async commitReorder(
    userId: string,
    list: BookList,
    items: BookListItem[],
    payload: Record<string, unknown>,
  ) {
    const outboxItem = makeOutboxItem(userId, "book_lists", list.id, "reorder", payload);
    await localDriver.commitMutation(
      [
        {
          table: "book_lists",
          record: toLocalRecord(userId, list, "pending"),
        },
        ...items.map((item) => ({
          table: "book_list_items" as const,
          record: toLocalRecord(userId, item, "pending"),
        })),
      ],
      outboxItem,
    );
    return outboxItem;
  },
};
export const bookListItemsRepo = {
  ...baseBookListItemsRepo,
  async markReorderSynced(userId: string, listId: string, mutationUpdatedAt: string) {
    const records = await localDriver.listRecords<BookListItem>(
      "book_list_items",
      userId,
      { includeDeleted: true },
    );
    const matching = records.filter(
      (record) =>
        record.status === "pending" &&
        record.data.list_id === listId &&
        record.data.updated_at === mutationUpdatedAt,
    );
    if (matching.length === 0) return;
    await localDriver.upsertRecords(
      "book_list_items",
      matching.map((record) => toLocalRecord(userId, record.data, "synced")),
    );
  },
};

const createLocalOnlyRepo = <T extends { id: string }>(table: LocalTableName) => ({
  async list(userId: string): Promise<T[]> {
    const records = await localDriver.listRecords<T>(table, userId);
    return records.map((record) => record.data);
  },
  async get(id: string): Promise<T | null> {
    return (await localDriver.getRecord<T>(table, id))?.data ?? null;
  },
  async upsert(userId: string, item: T & { updated_at?: string | null; created_at?: string | null }) {
    await localDriver.upsertRecord(table, toLocalRecord(userId, item, "synced"));
    return item;
  },
  async remove(id: string) {
    await localDriver.removeRecord(table, id);
  },
});

export const pendingBookImportsRepo =
  createLocalOnlyRepo<PendingBookImport>("pending_book_imports");
export const bookSearchCacheRepo =
  createLocalOnlyRepo<BookSearchCacheEntry>("book_search_cache");
export const contentSnapshotsRepo =
  createLocalOnlyRepo<ContentSnapshot>("content_snapshots");

export const profilePreferencesRepo = {
  async get(userId: string) {
    return (await localDriver.getRecord<ProfilePreferencesPayload>("profile_preferences", userId))?.data ?? null;
  },

  async upsertRemote(userId: string, preferences: ProfilePreferencesPayload) {
    await localDriver.upsertRecord("profile_preferences", {
      id: userId,
      user_id: userId,
      data: preferences,
      status: "synced",
      updated_at: preferences.updated_at || nowIso(),
      last_synced_at: nowIso(),
    });
  },

  async upsertLocal(userId: string, preferences: ProfilePreferencesPayload) {
    const payload = {
      ...preferences,
      id: userId,
      updated_at: preferences.updated_at || nowIso(),
    };
    const record = {
      id: userId,
      user_id: userId,
      data: payload,
      status: "pending",
      updated_at: payload.updated_at || nowIso(),
    } satisfies LocalRecord<ProfilePreferencesPayload>;
    await localDriver.commitMutation(
      [{ table: "profile_preferences", record }],
      makeOutboxItem(userId, "profile_preferences", userId, "update", payload),
    );
    return payload;
  },
};

export const syncRepo = {
  enqueue: localDriver.enqueueOutbox.bind(localDriver),
  enqueueMutation(
    userId: string,
    entity: SyncEntity,
    entityId: string,
    operation: SyncOperation,
    payload: unknown
  ) {
    return localDriver.enqueueOutbox(
      makeOutboxItem(userId, entity, entityId, operation, payload)
    );
  },
  listPending(userId: string, options: { includeFreshSyncing?: boolean } = {}) {
    return localDriver.listOutbox(userId, ["pending", "syncing"]).then((items) =>
      items.filter((item) => {
        if (item.status === "pending") return true;
        return options.includeFreshSyncing
          || Date.parse(item.updated_at) < Date.now() - 10 * 60_000;
      })
    );
  },
  listOutstanding(userId: string) {
    return localDriver.listOutbox(userId, ["pending", "syncing"]);
  },
  listFailed(userId: string) {
    return localDriver.listOutbox(userId, ["failed"]);
  },
  markSyncing(item: OutboxItem) {
    return localDriver.updateOutbox(item.id, {
      status: "syncing",
      attempt_count: item.attempt_count + 1,
      updated_at: nowIso(),
    });
  },
  markSynced(item: OutboxItem) {
    return localDriver.updateOutbox(item.id, {
      status: "synced",
      updated_at: nowIso(),
    });
  },
  markFailed(item: OutboxItem, error: string) {
    return localDriver.updateOutbox(item.id, {
      status: "failed",
      last_error: error,
      updated_at: nowIso(),
      next_attempt_at: new Date(Date.now() + Math.min(300000, 5000 * (item.attempt_count + 1))).toISOString(),
    });
  },
  deferRetry(item: OutboxItem, error: string, retryAfterMs?: number) {
    const delayMs = Math.max(
      5000,
      Math.min(15 * 60_000, retryAfterMs ?? 5000 * (item.attempt_count + 1))
    );
    return localDriver.updateOutbox(item.id, {
      status: "pending",
      last_error: error,
      updated_at: nowIso(),
      next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
    });
  },
  retry(item: OutboxItem) {
    return localDriver.updateOutbox(item.id, {
      status: "pending",
      last_error: null,
      next_attempt_at: null,
      updated_at: nowIso(),
    });
  },
  delete: localDriver.deleteOutbox.bind(localDriver),
  counts(userId: string): Promise<OutboxCounts> {
    return localDriver.getOutboxCounts(userId);
  },
  getState(userId: string, scope: string): Promise<SyncState | null> {
    return localDriver.getSyncState(userId, scope);
  },
  setState(state: SyncState) {
    return localDriver.setSyncState(state);
  },
};

export const localRepositories = {
  books: booksRepo,
  sessions: sessionsRepo,
  progress: progressRepo,
  journal: journalRepo,
  goals: goalsRepo,
  bookLists: bookListsRepo,
  bookListItems: bookListItemsRepo,
  profilePreferences: profilePreferencesRepo,
  pendingBookImports: pendingBookImportsRepo,
  bookSearchCache: bookSearchCacheRepo,
  contentSnapshots: contentSnapshotsRepo,
  sync: syncRepo,
};
