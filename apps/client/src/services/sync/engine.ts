import { pullSyncChanges, pushSyncMutations } from "@/services/api/sync";
import { getApiRetryAfterMs } from "@/services/api/client";
import { emitBooksChanged, fetchUserBooksPage } from "@/services/api/books";
import { getOptionalCurrentAuthUser } from "@/services/api/auth";
import {
  booksRepo,
  bookListItemsRepo,
  bookListsRepo,
  goalsRepo,
  journalRepo,
  pendingBookImportsRepo,
  profilePreferencesRepo,
  progressRepo,
  sessionsRepo,
  syncRepo,
} from "@/services/local";
import type {
  OutboxItem,
  ProgressLogPayload,
  SyncPullResponse,
  SyncPushAcceptedItem,
  SyncPushFailedItem,
} from "./types";
import type { Book, BookList, BookListItem, Goal, ReadingSession } from "@/types";
import type { JournalEntry } from "@/services/api/journal";
import { isConnectivityAvailable } from "@/services/connectivity";
import { trackCoreEvent } from "@/services/telemetry";
import { findExistingLibraryBook } from "@/utils/bookIdentity";
import { isBookIdentityConflict } from "./bookConflict";

export const SYNC_STATUS_EVENT = "brack:sync-status-changed";

export interface SyncStatusDetail {
  userId?: string | null;
  pending: number;
  failed: number;
  syncing: number;
  lastSyncedAt?: string | null;
}

export interface SyncOptions {
  /** Ignore retry delays and reclaim in-flight records. Used only for an explicit retry. */
  forcePending?: boolean;
}

export interface ServerBookCopySafety {
  safe: boolean;
  relatedChangeCount: number;
}

const SYNCING_STALE_AFTER_MS = 10 * 60_000;
const MAX_TIMER_DELAY_MS = 2_147_483_647;
const MIN_RETRY_DELAY_MS = 50;
const BOOK_SYNC_SNAPSHOT_KEY = "__sync_snapshot";
const BOOK_CONFLICT_LOOKUP_PAGE_SIZE = 100;

interface SyncTimerApi {
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(timerId: number): void;
}

const browserTimerApi: SyncTimerApi = {
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (timerId) => window.clearTimeout(timerId),
};

const notifySyncStatus = (detail: SyncStatusDetail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SyncStatusDetail>(SYNC_STATUS_EVENT, { detail }));
};

const getRecordUserId = (record: { user_id?: string | null }, fallbackUserId: string) =>
  record.user_id || fallbackUserId;

const asPayloadRecord = (payload: unknown): Record<string, unknown> =>
  typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};

/**
 * A shelf migration can briefly reach the client/Edge Function before
 * PostgREST has refreshed the books schema. That is an operator/deployment
 * problem, not a local edit the reader can resolve by reviewing or discarding.
 * Keep the check deliberately narrow so ordinary validation failures still
 * move to review.
 */
const isRecoverableBookshelfSchemaFailure = (
  item: Pick<OutboxItem, "entity" | "payload">,
  error: string | null | undefined,
) => {
  if (item.entity !== "books" || !error) return false;

  const payload = asPayloadRecord(item.payload);
  if (!Object.prototype.hasOwnProperty.call(payload, "shelf_position")) {
    return false;
  }

  const message = error.toLowerCase();
  return (
    message.includes("shelf_position") &&
    message.includes("books") &&
    message.includes("schema cache") &&
    (message.includes("could not find") || message.includes("pgrst204"))
  );
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactOutboxIdentity = (
  responseItem: unknown,
  sourceItem: OutboxItem,
): responseItem is Record<string, unknown> =>
  isObjectRecord(responseItem) &&
  responseItem.id === sourceItem.id &&
  responseItem.client_mutation_id === sourceItem.client_mutation_id &&
  responseItem.entity === sourceItem.entity &&
  responseItem.client_entity_id === sourceItem.client_entity_id;

const getAcceptedRecordValidationError = (
  userId: string,
  accepted: SyncPushAcceptedItem,
) => {
  if (!isObjectRecord(accepted.record)) {
    return "Sync server returned an accepted change without a valid record";
  }

  const rawRecordId =
    typeof accepted.record.id === "string" ? accepted.record.id : "";
  const recordId = rawRecordId.trim();
  if (!recordId || rawRecordId !== recordId) {
    return "Sync server returned an accepted change without a valid record id";
  }

  if (accepted.entity === "books") {
    const rawServerEntityId =
      typeof accepted.server_entity_id === "string"
        ? accepted.server_entity_id
        : "";
    const serverEntityId = rawServerEntityId.trim();
    if (
      !serverEntityId ||
      rawServerEntityId !== serverEntityId ||
      serverEntityId !== recordId
    ) {
      return "Sync server returned an invalid canonical book id";
    }
    if (accepted.record.user_id !== userId) {
      return "Sync server returned a book for a different account";
    }
  }

  return null;
};

const isStructurallyValidFailure = (
  responseItem: unknown,
): responseItem is SyncPushFailedItem =>
  isObjectRecord(responseItem) &&
  typeof responseItem.error === "string" &&
  typeof responseItem.retryable === "boolean";

const getBookConflictIdentity = async (item: OutboxItem) => {
  const payload = asPayloadRecord(item.payload);
  const snapshot = asPayloadRecord(payload[BOOK_SYNC_SNAPSHOT_KEY]);
  const localBook = await booksRepo.get(item.client_entity_id);
  const source = {
    ...(localBook ?? {}),
    ...snapshot,
    ...payload,
  };

  return {
    title: typeof source.title === "string" ? source.title : "",
    author: typeof source.author === "string" ? source.author : null,
    isbn: typeof source.isbn === "string" ? source.isbn : null,
  };
};

const findServerBookForConflict = async (userId: string, item: OutboxItem) => {
  const identity = await getBookConflictIdentity(item);
  if (!identity.isbn && !identity.title.trim()) {
    throw new Error("This local change does not contain enough book details to find the library copy");
  }

  let offset = 0;
  while (true) {
    const page = await fetchUserBooksPage(userId, offset, BOOK_CONFLICT_LOOKUP_PAGE_SIZE);
    const match = findExistingLibraryBook(identity, page.books);
    if (match) return match;
    if (!page.hasMore || page.books.length === 0) return null;
    offset += page.books.length;
  }
};

const outboxReferencesBook = (item: OutboxItem, bookId: string) => {
  if (item.entity === "books" && item.client_entity_id === bookId) return true;

  const payload = asPayloadRecord(item.payload);
  if (payload.book_id === bookId) return true;
  return Array.isArray(payload.ordered_book_ids) && payload.ordered_book_ids.includes(bookId);
};

const getUnsyncedLocalBookReferences = async (userId: string, bookId: string) => {
  const [sessions, progress, journal, listItems, pendingImports] = await Promise.all([
    sessionsRepo.listRecords(userId, { includeDeleted: true }),
    progressRepo.listRecords(userId, { includeDeleted: true }),
    journalRepo.listRecords(userId, { includeDeleted: true }),
    bookListItemsRepo.listRecords(userId, { includeDeleted: true }),
    pendingBookImportsRepo.list(userId),
  ]);

  return [
    ...sessions
      .filter((record) => record.status !== "synced" && record.data.book_id === bookId)
      .map((record) => `reading_sessions:${record.id}`),
    ...progress
      .filter((record) => record.status !== "synced" && record.data.book_id === bookId)
      .map((record) => `progress_logs:${record.id}`),
    ...journal
      .filter((record) => record.status !== "synced" && record.data.book_id === bookId)
      .map((record) => `journal_entries:${record.id}`),
    ...listItems
      .filter((record) => record.status !== "synced" && record.data.book_id === bookId)
      .map((record) => `book_list_items:${record.id}`),
    ...pendingImports
      .filter((pendingImport) => pendingImport.resolved_book_id === bookId)
      .map((pendingImport) => `pending_book_imports:${pendingImport.id}`),
  ];
};

const addBookSyncSnapshot = async (userId: string, item: OutboxItem): Promise<OutboxItem> => {
  if (item.entity !== "books" || item.operation !== "update") return item;

  const payload = asPayloadRecord(item.payload);
  if (payload[BOOK_SYNC_SNAPSHOT_KEY]) return item;

  let book = await booksRepo.get(item.client_entity_id);
  if (!book) {
    const isbn = typeof payload.isbn === "string" ? payload.isbn : null;
    const title = typeof payload.title === "string" ? payload.title : "";
    const author = typeof payload.author === "string" ? payload.author : null;
    if (isbn || title) {
      book = findExistingLibraryBook(
        { title, author, isbn },
        await booksRepo.list(userId),
      );
    }
  }

  if (!book) return item;
  return {
    ...item,
    payload: {
      ...payload,
      [BOOK_SYNC_SNAPSHOT_KEY]: {
        ...book,
        ...payload,
      },
    },
  };
};

const applyPulledRecords = async (userId: string, response: SyncPullResponse) => {
  await booksRepo.upsertRemoteManyPreservingLocal(
    userId,
    response.records.books as Book[],
  );
  await sessionsRepo.upsertRemoteManyPreservingLocal(
    userId,
    response.records.reading_sessions as ReadingSession[],
  );
  await progressRepo.upsertRemoteManyPreservingLocal(
    userId,
    (response.records.progress_logs as ProgressLogPayload[]).map((log) => ({
      ...log,
      id: log.id || crypto.randomUUID(),
    }))
  );
  await journalRepo.upsertRemoteManyPreservingLocal(
    userId,
    response.records.journal_entries as JournalEntry[],
  );
  await goalsRepo.upsertRemoteManyPreservingLocal(
    userId,
    response.records.goals as Goal[],
  );
  await bookListsRepo.upsertRemoteManyPreservingLocal(
    userId,
    response.records.book_lists as BookList[],
  );
  await bookListItemsRepo.upsertRemoteManyPreservingLocal(
    userId,
    response.records.book_list_items as BookListItem[]
  );

  const preferences = response.records.profile_preferences[0];
  if (preferences?.id) {
    await profilePreferencesRepo.upsertRemote(userId, {
      id: preferences.id,
      color_theme: preferences.color_theme ?? null,
      theme_mode: preferences.theme_mode ?? null,
      library_view_mode: preferences.library_view_mode ?? "flat",
      timezone: preferences.timezone ?? "UTC",
      leaderboard_opt_in: preferences.leaderboard_opt_in ?? false,
      leaderboard_eligible_from: preferences.leaderboard_eligible_from ?? null,
      gamification_profile_visible: preferences.gamification_profile_visible ?? true,
      updated_at: preferences.updated_at ?? null,
    });
  }

  if (response.records.books.length > 0) {
    emitBooksChanged({ type: "refresh", userId });
  }
  if (
    response.records.book_lists.length > 0 ||
    response.records.book_list_items.length > 0
  ) {
    window.dispatchEvent(
      new CustomEvent("brack:book-lists-changed", { detail: { userId } })
    );
  }
};

const applyAcceptedRecord = async (
  userId: string,
  accepted: SyncPushAcceptedItem,
  sourceItem: OutboxItem,
) => {
  if (!accepted.record) return false;
  let sourceOutboxDeleted = false;

  switch (accepted.entity) {
    case "books": {
      const book = accepted.record as Book;
      const resolvedBook = await booksRepo.remapIdentity(
        getRecordUserId(book, userId),
        accepted.client_entity_id,
        book,
        {
          sourceOutbox: {
            id: sourceItem.id,
            clientMutationId: sourceItem.client_mutation_id,
            expectedStatus: "syncing",
            expectedAttemptCount: sourceItem.attempt_count + 1,
          },
        },
      );
      sourceOutboxDeleted = true;
      if (accepted.client_entity_id !== book.id) {
        emitBooksChanged({
          type: "remove",
          userId,
          bookId: accepted.client_entity_id,
        });
      }
      if (resolvedBook.deleted_at) {
        emitBooksChanged({ type: "remove", userId, bookId: resolvedBook.id });
      } else {
        emitBooksChanged({ type: "upsert", userId, book: resolvedBook });
      }
      break;
    }
    case "reading_sessions": {
      const session = accepted.record as ReadingSession;
      if (accepted.client_entity_id !== session.id) {
        await sessionsRepo.remove(accepted.client_entity_id);
      }
      await sessionsRepo.upsertRemote(getRecordUserId(session, userId), session);
      break;
    }
    case "progress_logs": {
      const log = accepted.record as ProgressLogPayload & { id: string };
      if (accepted.client_entity_id !== log.id) {
        await progressRepo.remove(accepted.client_entity_id);
      }
      await progressRepo.upsertRemote(getRecordUserId(log, userId), log);
      break;
    }
    case "journal_entries": {
      const entry = accepted.record as JournalEntry;
      if (entry.deleted_at) {
        await journalRepo.remove(accepted.client_entity_id);
        break;
      }
      await journalRepo.upsertRemote(getRecordUserId(entry, userId), entry);
      break;
    }
    case "goals": {
      const goal = accepted.record as Goal;
      if (goal.deleted_at) {
        await goalsRepo.remove(accepted.client_entity_id);
        break;
      }
      await goalsRepo.upsertRemote(getRecordUserId(goal, userId), goal);
      break;
    }
    case "book_lists": {
      const list = accepted.record as BookList;
      if (sourceItem.operation === "reorder") {
        const sourcePayload =
          sourceItem.payload &&
          typeof sourceItem.payload === "object" &&
          !Array.isArray(sourceItem.payload)
            ? sourceItem.payload as Record<string, unknown>
            : {};
        const localList = await bookListsRepo.get(sourceItem.client_entity_id);
        const mutationVersion = Number(sourcePayload.order_version);
        const mutationUpdatedAt =
          typeof sourcePayload.updated_at === "string"
            ? sourcePayload.updated_at
            : "";
        const isCurrentReorder =
          localList?.order_version === mutationVersion &&
          localList.updated_at === mutationUpdatedAt;
        if (!isCurrentReorder) break;
        await bookListItemsRepo.markReorderSynced(
          userId,
          sourceItem.client_entity_id,
          mutationUpdatedAt,
        );
      }
      if (accepted.client_entity_id !== list.id) {
        await bookListsRepo.remove(accepted.client_entity_id);
      }
      if (list.deleted_at) {
        await bookListsRepo.remove(accepted.client_entity_id);
      } else {
        await bookListsRepo.upsertRemote(getRecordUserId(list, userId), list);
      }
      window.dispatchEvent(
        new CustomEvent("brack:book-lists-changed", { detail: { userId } })
      );
      break;
    }
    case "book_list_items": {
      const item = accepted.record as BookListItem;
      if (accepted.client_entity_id !== item.id) {
        await bookListItemsRepo.remove(accepted.client_entity_id);
      }
      if (item.deleted_at) {
        await bookListItemsRepo.remove(accepted.client_entity_id);
      } else {
        await bookListItemsRepo.upsertRemote(getRecordUserId(item, userId), item);
      }
      window.dispatchEvent(
        new CustomEvent("brack:book-lists-changed", { detail: { userId } })
      );
      break;
    }
    case "profile_preferences": {
      const preferences = accepted.record as {
        id: string;
        color_theme?: string | null;
        theme_mode?: string | null;
        library_view_mode?: "flat" | "bookshelf" | "carousel" | null;
        timezone?: string | null;
        leaderboard_opt_in?: boolean | null;
        leaderboard_eligible_from?: string | null;
        gamification_profile_visible?: boolean | null;
        updated_at?: string | null;
      };
      await profilePreferencesRepo.upsertRemote(preferences.id || userId, {
        id: preferences.id || userId,
        color_theme: preferences.color_theme ?? null,
        theme_mode: preferences.theme_mode ?? null,
        library_view_mode: preferences.library_view_mode ?? "flat",
        timezone: preferences.timezone ?? "UTC",
        leaderboard_opt_in: preferences.leaderboard_opt_in ?? false,
        leaderboard_eligible_from: preferences.leaderboard_eligible_from ?? null,
        gamification_profile_visible: preferences.gamification_profile_visible ?? true,
        updated_at: preferences.updated_at ?? null,
      });
      break;
    }
    default:
      break;
  }
  return sourceOutboxDeleted;
};

export class ReadingCoreSyncEngine {
  private activeSync: Promise<SyncStatusDetail> | null = null;
  private activeUserId: string | null = null;
  private resyncRequested = false;
  private forcePendingRequested = false;
  private retryTimers = new Map<string, { id: number; dueAt: number }>();

  constructor(private readonly timers: SyncTimerApi = browserTimerApi) {}

  private async notifyCurrentStatus(userId?: string | null) {
    const status = await this.getStatus(userId);
    notifySyncStatus(status);
    return status;
  }

  async getStatus(userId?: string | null): Promise<SyncStatusDetail> {
    let resolvedUserId = userId;
    if (typeof resolvedUserId === "undefined") {
      const user = await getOptionalCurrentAuthUser();
      resolvedUserId = user?.id ?? null;
    }

    if (!resolvedUserId) {
      return { userId: resolvedUserId, pending: 0, failed: 0, syncing: 0 };
    }

    const [counts, state] = await Promise.all([
      syncRepo.counts(resolvedUserId),
      syncRepo.getState(resolvedUserId, "reading_core"),
    ]);

    return {
      userId: resolvedUserId,
      ...counts,
      lastSyncedAt: state?.last_synced_at ?? null,
    };
  }

  async syncCurrentUser(options: SyncOptions = {}): Promise<SyncStatusDetail> {
    const user = await getOptionalCurrentAuthUser();
    if (!user) return this.getStatus(null);
    return this.syncUser(user.id, options);
  }

  async listFailedCurrentUser(): Promise<OutboxItem[]> {
    const user = await getOptionalCurrentAuthUser();
    if (!user) return [];
    return syncRepo.listFailed(user.id);
  }

  async retryFailedItem(item: OutboxItem): Promise<SyncStatusDetail> {
    await syncRepo.retry(item);
    const status = await this.notifyCurrentStatus(item.user_id);

    if (isConnectivityAvailable()) {
      return this.syncUser(item.user_id);
    }

    return status;
  }

  async discardFailedItem(item: OutboxItem): Promise<SyncStatusDetail> {
    await this.discardLocalEffect(item);
    await syncRepo.delete(item.id);
    return this.notifyCurrentStatus(item.user_id);
  }

  async getServerBookCopySafety(item: OutboxItem): Promise<ServerBookCopySafety> {
    if (!isBookIdentityConflict(item)) return { safe: false, relatedChangeCount: 0 };

    const [outstanding, failed, localReferences] = await Promise.all([
      syncRepo.listOutstanding(item.user_id),
      syncRepo.listFailed(item.user_id),
      getUnsyncedLocalBookReferences(item.user_id, item.client_entity_id),
    ]);
    const relatedOutbox = [...outstanding, ...failed]
      .filter((candidate) => candidate.id !== item.id)
      .filter((candidate) => outboxReferencesBook(candidate, item.client_entity_id));
    const representedLocalChanges = new Set(
      relatedOutbox.map((candidate) => `${candidate.entity}:${candidate.client_entity_id}`),
    );
    const orphanedLocalChangeCount = localReferences.filter(
      (reference) => !representedLocalChanges.has(reference),
    ).length;
    const relatedChangeCount = new Set(relatedOutbox.map((candidate) => candidate.id)).size
      + orphanedLocalChangeCount;

    return {
      safe: relatedChangeCount === 0,
      relatedChangeCount,
    };
  }

  /**
   * Resolves a duplicate/stale book identity by keeping the authoritative active
   * server row and removing only this device's conflicting row and failed mutation.
   * Callers must explicitly confirm first because an update payload can contain
   * edits that have never reached the server.
   */
  async useServerBookCopy(item: OutboxItem): Promise<{ book: Book; status: SyncStatusDetail }> {
    if (item.status !== "failed" || !isBookIdentityConflict(item)) {
      throw new Error("Only failed duplicate book creates, updates, or restores can use a server library copy");
    }

    const user = await getOptionalCurrentAuthUser();
    if (!user || user.id !== item.user_id) {
      throw new Error("Sign in to the account that owns this reading change");
    }
    if (!isConnectivityAvailable()) {
      throw new Error("Reconnect before loading the synced library copy");
    }

    const safety = await this.getServerBookCopySafety(item);
    if (!safety.safe) {
      throw new Error(
        `${safety.relatedChangeCount} other unsynced reading change${
          safety.relatedChangeCount === 1 ? "" : "s"
        } still depend on this local book. Those changes were kept.`,
      );
    }

    const serverBook = await findServerBookForConflict(item.user_id, item);
    if (!serverBook) {
      throw new Error("A matching synced library copy could not be found. Your local change was kept.");
    }

    const finalSafety = await this.getServerBookCopySafety(item);
    if (!finalSafety.safe) {
      throw new Error(
        `${finalSafety.relatedChangeCount} other unsynced reading change${
          finalSafety.relatedChangeCount === 1 ? "" : "s"
        } appeared while the library copy was loading. Those changes were kept.`,
      );
    }

    const resolvedBook = await booksRepo.remapIdentity(
      item.user_id,
      item.client_entity_id,
      serverBook,
      {
        sourceOutbox: {
          id: item.id,
          clientMutationId: item.client_mutation_id,
          expectedStatus: "failed",
          expectedAttemptCount: item.attempt_count,
        },
        requireNoOtherUnsyncedReferences: true,
      },
    );

    if (item.client_entity_id !== serverBook.id) {
      emitBooksChanged({ type: "remove", userId: item.user_id, bookId: item.client_entity_id });
    }
    emitBooksChanged({ type: "upsert", userId: item.user_id, book: resolvedBook });

    return {
      book: resolvedBook,
      status: await this.notifyCurrentStatus(item.user_id),
    };
  }

  async syncUser(userId: string, options: SyncOptions = {}): Promise<SyncStatusDetail> {
    if (!isConnectivityAvailable()) {
      const status = await this.getStatus(userId);
      notifySyncStatus(status);
      return status;
    }

    if (this.activeSync) {
      if (this.activeUserId === userId) {
        this.resyncRequested = true;
        this.forcePendingRequested ||= options.forcePending === true;
        return this.activeSync;
      }

      try {
        await this.activeSync;
      } catch {
        // A different signed-in user should still get an independent sync attempt.
      }
      return this.syncUser(userId, options);
    }

    this.clearRetryTimer(userId);
    const sync = this.runSync(userId, options.forcePending === true);
    this.activeSync = sync;
    this.activeUserId = userId;
    try {
      return await sync;
    } finally {
      if (this.activeSync === sync) {
        this.activeSync = null;
        this.activeUserId = null;
        this.resyncRequested = false;
        this.forcePendingRequested = false;
      }
    }
  }

  private async runSync(userId: string, forcePending: boolean): Promise<SyncStatusDetail> {
    notifySyncStatus(await this.getStatus(userId));

    try {
      let status: SyncStatusDetail;
      do {
        const forceThisPass = forcePending || this.forcePendingRequested;
        forcePending = false;
        this.forcePendingRequested = false;
        this.resyncRequested = false;
        await this.pushPending(userId, forceThisPass);
        await this.pullLatest(userId);
        status = await this.getStatus(userId);
      } while (this.resyncRequested && isConnectivityAvailable());

      trackCoreEvent("sync_succeeded");
      notifySyncStatus(status);
      await this.scheduleAutomaticRetry(userId);
      return status;
    } catch (error) {
      trackCoreEvent("sync_failed", {
        reason: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      });
      await this.notifyCurrentStatus(userId).catch(() => undefined);
      await this.scheduleAutomaticRetry(userId).catch(() => undefined);
      throw error;
    }
  }

  private async pushPending(userId: string, forcePending = false) {
    // Older app versions may already have classified this rollout mismatch as
    // permanent. Promote those durable edits back to the retry queue before
    // reading pending work so they recover without requiring 1-by-1 review.
    const recoverableFailures = (await syncRepo.listFailed(userId)).filter((item) =>
      isRecoverableBookshelfSchemaFailure(item, item.last_error)
    );
    if (recoverableFailures.length > 0) {
      await Promise.all(recoverableFailures.map((item) => syncRepo.retry(item)));
    }

    const pendingItems = await syncRepo.listPending(userId, {
      includeFreshSyncing: forcePending,
    });
    if (pendingItems.length === 0) return;

    const eligible = forcePending ? pendingItems : pendingItems.filter((item) => {
      if (!item.next_attempt_at) return true;
      const nextAttemptAt = Date.parse(item.next_attempt_at);
      return !Number.isFinite(nextAttemptAt) || nextAttemptAt <= Date.now();
    });

    if (eligible.length === 0) return;

    await Promise.all(eligible.map((item) => syncRepo.markSyncing(item)));

    const settledIds = new Set<string>();
    try {
      const pushItems = await Promise.all(
        eligible.map((item) => addBookSyncSnapshot(userId, item)),
      );
      const response = await pushSyncMutations({ items: pushItems });
      if (!response || !Array.isArray(response.accepted) || !Array.isArray(response.failed)) {
        throw new Error("Sync server returned an invalid response");
      }

      for (const item of eligible) {
        const accepted = response.accepted.find((responseItem) =>
          hasExactOutboxIdentity(responseItem, item)
        ) as SyncPushAcceptedItem | undefined;
        if (accepted) {
          const validationError = getAcceptedRecordValidationError(userId, accepted);
          if (validationError) {
            await syncRepo.deferRetry(item, validationError);
            settledIds.add(item.id);
            continue;
          }

          const sourceOutboxDeleted = await applyAcceptedRecord(userId, accepted, item);
          if (!sourceOutboxDeleted) {
            await syncRepo.delete(item.id);
          }
          settledIds.add(item.id);
          continue;
        }

        const failedResponse = response.failed.find((responseItem) =>
          hasExactOutboxIdentity(responseItem, item)
        );
        const failed = failedResponse && isStructurallyValidFailure(failedResponse)
          ? failedResponse
          : undefined;
        if (
          failed?.retryable !== false ||
          (failed && isRecoverableBookshelfSchemaFailure(item, failed.error))
        ) {
          await syncRepo.deferRetry(item, failed?.error || "Sync server returned no result");
        } else {
          await syncRepo.markFailed(item, failed.error || "Sync failed");
        }
        settledIds.add(item.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      const retryAfterMs = getApiRetryAfterMs(error) ?? undefined;
      await Promise.all(
        eligible
          .filter((item) => !settledIds.has(item.id))
          .map((item) => syncRepo.deferRetry(item, message, retryAfterMs)),
      );
      throw error;
    }
  }

  private clearRetryTimer(userId: string) {
    const scheduled = this.retryTimers.get(userId);
    if (!scheduled) return;
    this.timers.clearTimeout(scheduled.id);
    this.retryTimers.delete(userId);
  }

  private async scheduleAutomaticRetry(userId: string) {
    this.clearRetryTimer(userId);

    const outstanding = await syncRepo.listOutstanding(userId);
    if (outstanding.length === 0) return;

    const now = Date.now();
    const dueAt = Math.min(
      ...outstanding.map((item) => {
        if (item.status === "syncing") {
          const updatedAt = Date.parse(item.updated_at);
          return Number.isFinite(updatedAt) ? updatedAt + SYNCING_STALE_AFTER_MS : now;
        }

        const nextAttemptAt = item.next_attempt_at
          ? Date.parse(item.next_attempt_at)
          : now;
        return Number.isFinite(nextAttemptAt) ? nextAttemptAt : now;
      }),
    );
    const delay = Math.min(MAX_TIMER_DELAY_MS, Math.max(MIN_RETRY_DELAY_MS, dueAt - now));
    const timerId = this.timers.setTimeout(async () => {
      this.retryTimers.delete(userId);
      if (!isConnectivityAvailable()) return;

      const user = await getOptionalCurrentAuthUser();
      if (user?.id !== userId) return;

      await this.syncUser(userId).catch(() => {
        // runSync records the failure, restores the queue state, and schedules the next retry.
      });
    }, delay);
    this.retryTimers.set(userId, { id: timerId, dueAt });
  }

  private async pullLatest(userId: string) {
    const state = await syncRepo.getState(userId, "reading_core");
    let cursor = state?.cursor ?? null;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < 20) {
      const response = await pullSyncChanges(cursor);
      await applyPulledRecords(userId, response);
      cursor = response.cursor;
      hasMore = Boolean(response.has_more);
      pageCount += 1;
    }

    await syncRepo.setState({
      key: `${userId}:reading_core`,
      user_id: userId,
      cursor,
      last_synced_at: new Date().toISOString(),
    });
  }

  private async discardLocalEffect(item: OutboxItem) {
    if (item.operation === "create" || item.operation === "restore") {
      switch (item.entity) {
        case "books":
          await booksRepo.remove(item.client_entity_id);
          emitBooksChanged({ type: "remove", userId: item.user_id, bookId: item.client_entity_id });
          break;
        case "reading_sessions":
          await sessionsRepo.remove(item.client_entity_id);
          break;
        case "progress_logs":
          await progressRepo.remove(item.client_entity_id);
          break;
        case "journal_entries":
          await journalRepo.remove(item.client_entity_id);
          break;
        case "goals":
          await goalsRepo.remove(item.client_entity_id);
          break;
        case "book_lists":
          await bookListsRepo.remove(item.client_entity_id);
          break;
        case "book_list_items":
          await bookListItemsRepo.remove(item.client_entity_id);
          break;
        default:
          break;
      }
      return;
    }

    if (item.operation === "delete") {
      switch (item.entity) {
        case "books": {
          const restored = await booksRepo.restoreDeletedLocal(item.client_entity_id);
          if (restored) emitBooksChanged({ type: "upsert", userId: item.user_id, book: restored });
          break;
        }
        case "journal_entries":
          await journalRepo.restoreDeletedLocal(item.client_entity_id);
          break;
        case "goals":
          await goalsRepo.restoreDeletedLocal(item.client_entity_id);
          break;
        case "book_lists":
          await bookListsRepo.restoreDeletedLocal(item.client_entity_id);
          break;
        case "book_list_items":
          await bookListItemsRepo.restoreDeletedLocal(item.client_entity_id);
          break;
        default:
          break;
      }
    }
  }
}

export const readingCoreSync = new ReadingCoreSyncEngine();

export const markOutboxItemFailed = async (item: OutboxItem, failure: SyncPushFailedItem) => {
  await syncRepo.markFailed(item, failure.error);
};
