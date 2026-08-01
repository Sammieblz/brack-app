import { pullSyncChanges, pushSyncMutations } from "@/services/api/sync";
import { getApiRetryAfterMs } from "@/services/api/client";
import { emitBooksChanged } from "@/services/api/books";
import { getCurrentAuthUser } from "@/services/api/auth";
import {
  booksRepo,
  bookListItemsRepo,
  bookListsRepo,
  goalsRepo,
  journalRepo,
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
import { resolveBookSyncConflict } from "./conflicts";

export const SYNC_STATUS_EVENT = "brack:sync-status-changed";

export interface SyncStatusDetail {
  userId?: string | null;
  pending: number;
  failed: number;
  syncing: number;
  lastSyncedAt?: string | null;
}

const notifySyncStatus = (detail: SyncStatusDetail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SyncStatusDetail>(SYNC_STATUS_EVENT, { detail }));
};

const getRecordUserId = (record: { user_id?: string | null }, fallbackUserId: string) =>
  record.user_id || fallbackUserId;

const applyPulledRecords = async (userId: string, response: SyncPullResponse) => {
  const localBookRecords = new Map(
    (await booksRepo.listRecords(userId, { includeDeleted: true })).map(
      (record) => [record.id, record],
    ),
  );
  for (const remoteBook of response.records.books as Book[]) {
    const localBook = localBookRecords.get(remoteBook.id);
    if (!localBook || localBook.status === "synced") {
      await booksRepo.upsertRemote(userId, remoteBook);
      continue;
    }

    const resolved = resolveBookSyncConflict(localBook, remoteBook);
    if (resolved === remoteBook) {
      await booksRepo.upsertRemote(userId, remoteBook);
    }
  }
  await sessionsRepo.upsertRemoteMany(userId, response.records.reading_sessions as ReadingSession[]);
  await progressRepo.upsertRemoteMany(
    userId,
    (response.records.progress_logs as ProgressLogPayload[]).map((log) => ({
      ...log,
      id: log.id || crypto.randomUUID(),
    }))
  );
  await journalRepo.upsertRemoteMany(userId, response.records.journal_entries as JournalEntry[]);
  await goalsRepo.upsertRemoteMany(userId, response.records.goals as Goal[]);
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
  if (!accepted.record) return;

  switch (accepted.entity) {
    case "books": {
      const book = accepted.record as Book;
      if (accepted.client_entity_id !== book.id) {
        await booksRepo.remove(accepted.client_entity_id);
      }
      await booksRepo.upsertRemote(getRecordUserId(book, userId), book);
      if (book.deleted_at) {
        emitBooksChanged({ type: "remove", userId, bookId: book.id });
      } else {
        emitBooksChanged({ type: "upsert", userId, book });
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
};

export class ReadingCoreSyncEngine {
  private activeSync: Promise<SyncStatusDetail> | null = null;
  private activeUserId: string | null = null;
  private resyncRequested = false;

  private async notifyCurrentStatus(userId?: string | null) {
    const status = await this.getStatus(userId);
    notifySyncStatus(status);
    return status;
  }

  async getStatus(userId?: string | null): Promise<SyncStatusDetail> {
    let resolvedUserId = userId;
    if (typeof resolvedUserId === "undefined") {
      const user = await getCurrentAuthUser().catch(() => null);
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

  async syncCurrentUser(): Promise<SyncStatusDetail> {
    const user = await getCurrentAuthUser();
    if (!user) return this.getStatus(null);
    return this.syncUser(user.id);
  }

  async listFailedCurrentUser(): Promise<OutboxItem[]> {
    const user = await getCurrentAuthUser().catch(() => null);
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

  async syncUser(userId: string): Promise<SyncStatusDetail> {
    if (!isConnectivityAvailable()) {
      const status = await this.getStatus(userId);
      notifySyncStatus(status);
      return status;
    }

    if (this.activeSync) {
      if (this.activeUserId === userId) {
        this.resyncRequested = true;
        return this.activeSync;
      }

      try {
        await this.activeSync;
      } catch {
        // A different signed-in user should still get an independent sync attempt.
      }
      return this.syncUser(userId);
    }

    const sync = this.runSync(userId);
    this.activeSync = sync;
    this.activeUserId = userId;
    try {
      return await sync;
    } finally {
      if (this.activeSync === sync) {
        this.activeSync = null;
        this.activeUserId = null;
        this.resyncRequested = false;
      }
    }
  }

  private async runSync(userId: string): Promise<SyncStatusDetail> {
    notifySyncStatus(await this.getStatus(userId));

    try {
      let status: SyncStatusDetail;
      do {
        this.resyncRequested = false;
        await this.pushPending(userId);
        await this.pullLatest(userId);
        status = await this.getStatus(userId);
      } while (this.resyncRequested && isConnectivityAvailable());

      trackCoreEvent("sync_succeeded");
      notifySyncStatus(status);
      return status;
    } catch (error) {
      trackCoreEvent("sync_failed", {
        reason: error instanceof Error ? error.message.slice(0, 160) : "unknown",
      });
      throw error;
    }
  }

  private async pushPending(userId: string) {
    const pendingItems = await syncRepo.listPending(userId);
    if (pendingItems.length === 0) return;

    const eligible = pendingItems.filter((item) => {
      if (!item.next_attempt_at) return true;
      return Date.parse(item.next_attempt_at) <= Date.now();
    });

    if (eligible.length === 0) return;

    await Promise.all(eligible.map((item) => syncRepo.markSyncing(item)));

    let response;
    try {
      response = await pushSyncMutations({ items: eligible });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      const retryAfterMs = getApiRetryAfterMs(error) ?? undefined;
      await Promise.all(eligible.map((item) => syncRepo.deferRetry(item, message, retryAfterMs)));
      throw error;
    }
    const acceptedById = new Map<string, SyncPushAcceptedItem>(
      response.accepted.map((item) => [item.id, item]),
    );
    const failedById = new Map<string, SyncPushFailedItem>(
      response.failed.map((item) => [item.id, item]),
    );

    for (const item of eligible) {
      const accepted = acceptedById.get(item.id);
      if (accepted) {
        await applyAcceptedRecord(userId, accepted, item);
        await syncRepo.delete(item.id);
        continue;
      }

      const failed = failedById.get(item.id);
      if (failed?.retryable !== false) {
        await syncRepo.deferRetry(item, failed?.error || "Sync failed");
      } else {
        await syncRepo.markFailed(item, failed?.error || "Sync failed");
      }
    }
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
