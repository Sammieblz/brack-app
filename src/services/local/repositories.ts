import type { Book, Goal, ReadingSession } from "@/types";
import type { JournalEntry } from "@/services/api/journal";
import { localDriver, type LocalTableName, type OutboxCounts } from "./driver";
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

  async upsertLocal(userId: string, item: T, operation: SyncOperation = "update") {
    const updatedItem = {
      ...item,
      updated_at: (item as T & { updated_at?: string }).updated_at || nowIso(),
    } as T & { updated_at?: string };

    await localDriver.upsertRecord<T>(
      table,
      toLocalRecord(userId, updatedItem, operation === "delete" ? "deleted" : "pending")
    );
    await localDriver.enqueueOutbox(makeOutboxItem(userId, entity, item.id, operation, updatedItem));
    return updatedItem;
  },

  async softDeleteLocal(userId: string, item: T) {
    const deletedAt = nowIso();
    const deletedItem = {
      ...item,
      updated_at: deletedAt,
      deleted_at: deletedAt,
    } as T & { updated_at: string; deleted_at: string };

    await localDriver.upsertRecord<T>(table, toLocalRecord(userId, deletedItem, "deleted"));
    await localDriver.enqueueOutbox(makeOutboxItem(userId, entity, item.id, "delete", deletedItem));
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

export const booksRepo = createEntityRepo<Book>("books", "books");
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
    await localDriver.upsertRecord("profile_preferences", {
      id: userId,
      user_id: userId,
      data: payload,
      status: "pending",
      updated_at: payload.updated_at || nowIso(),
    });
    await localDriver.enqueueOutbox(
      makeOutboxItem(userId, "profile_preferences", userId, "update", payload)
    );
    return payload;
  },
};

export const syncRepo = {
  enqueue: localDriver.enqueueOutbox.bind(localDriver),
  listPending(userId: string) {
    return localDriver.listOutbox(userId, ["pending", "failed", "syncing"]);
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
  profilePreferences: profilePreferencesRepo,
  sync: syncRepo,
};
