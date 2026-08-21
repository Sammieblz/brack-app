import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  booksRepo,
  localDriver,
  pendingBookImportsRepo,
  progressRepo,
  syncRepo,
} from "@/services/local";
import type { Book } from "@/types";

const {
  emitBooksChangedMock,
  fetchUserBooksPageMock,
  getCurrentAuthUserMock,
  pullSyncChangesMock,
  pushSyncMutationsMock,
} = vi.hoisted(() => ({
  emitBooksChangedMock: vi.fn(),
  fetchUserBooksPageMock: vi.fn(),
  getCurrentAuthUserMock: vi.fn(),
  pullSyncChangesMock: vi.fn(),
  pushSyncMutationsMock: vi.fn(),
}));

vi.mock("@/services/api/sync", () => ({
  pullSyncChanges: pullSyncChangesMock,
  pushSyncMutations: pushSyncMutationsMock,
}));

vi.mock("@/services/api/auth", () => ({
  getCurrentAuthUser: getCurrentAuthUserMock,
}));

vi.mock("@/services/api/books", () => ({
  emitBooksChanged: emitBooksChangedMock,
  fetchUserBooksPage: fetchUserBooksPageMock,
}));

vi.mock("@/services/connectivity", () => ({
  isConnectivityAvailable: () => true,
}));

vi.mock("@/services/telemetry", () => ({
  trackCoreEvent: vi.fn(),
}));

import { ReadingCoreSyncEngine } from "./engine";

const emptyPullResponse = {
  records: {
    books: [],
    reading_sessions: [],
    progress_logs: [],
    journal_entries: [],
    goals: [],
    profile_preferences: [],
    book_lists: [],
    book_list_items: [],
  },
  cursor: "2026-07-01T00:00:00.000Z",
  has_more: false,
};

const acceptItems = (items: Array<Record<string, unknown>>) => ({
  accepted: items.map((item) => ({
    id: item.id,
    client_mutation_id: item.client_mutation_id,
    entity: item.entity,
    client_entity_id: item.client_entity_id,
    server_entity_id: item.client_entity_id,
    record: {
      ...(typeof item.payload === "object" && item.payload !== null
        ? item.payload
        : {}),
      id: item.client_entity_id,
      user_id: item.user_id,
    },
  })),
  failed: [],
  cursor: "2026-07-01T00:00:00.000Z",
});

const makeBook = (overrides: Partial<Book> & Pick<Book, "id" | "user_id" | "title">): Book => ({
  author: null,
  isbn: null,
  genre: null,
  pages: null,
  chapters: null,
  cover_url: null,
  description: null,
  status: "to_read",
  tags: null,
  metadata: null,
  current_page: 0,
  date_started: null,
  date_finished: null,
  rating: null,
  notes: null,
  source_provider: null,
  source_id: null,
  shelf_position: null,
  created_at: "2026-06-19T22:35:40.000Z",
  updated_at: "2026-06-19T22:35:40.000Z",
  deleted_at: null,
  ...overrides,
});

describe("reading core sync behavior", () => {
  beforeEach(() => {
    getCurrentAuthUserMock.mockReset();
    getCurrentAuthUserMock.mockResolvedValue(null);
    pullSyncChangesMock.mockReset();
    pushSyncMutationsMock.mockReset();
    emitBooksChangedMock.mockReset();
    fetchUserBooksPageMock.mockReset();
    fetchUserBooksPageMock.mockResolvedValue({ books: [], hasMore: false });
    pullSyncChangesMock.mockResolvedValue(emptyPullResponse);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("runs another pass when a mutation arrives during an active push", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    let releaseFirstPush: (() => void) | null = null;

    pushSyncMutationsMock
      .mockImplementationOnce(
        ({ items }: { items: Array<Record<string, unknown>> }) =>
          new Promise((resolve) => {
            releaseFirstPush = () => resolve(acceptItems(items));
          }),
      )
      .mockImplementation(
        ({ items }: { items: Array<Record<string, unknown>> }) =>
          Promise.resolve(acceptItems(items)),
      );

    await syncRepo.enqueueMutation(userId, "goals", "goal-1", "create", {
      id: "goal-1",
    });
    const engine = new ReadingCoreSyncEngine();
    const firstSync = engine.syncUser(userId);
    await vi.waitFor(() => expect(pushSyncMutationsMock).toHaveBeenCalledTimes(1));

    await syncRepo.enqueueMutation(userId, "goals", "goal-2", "create", {
      id: "goal-2",
    });
    const secondSync = engine.syncUser(userId);
    releaseFirstPush?.();

    await Promise.all([firstSync, secondSync]);

    expect(pushSyncMutationsMock).toHaveBeenCalledTimes(2);
    expect(pushSyncMutationsMock.mock.calls[1][0].items).toEqual([
      expect.objectContaining({ client_entity_id: "goal-2" }),
    ]);
    expect(await syncRepo.listPending(userId)).toEqual([]);
  });

  it("lets an explicit sync bypass retry backoff", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    await syncRepo.enqueueMutation(userId, "goals", "goal-manual", "create", {
      id: "goal-manual",
    });
    await syncRepo.enqueueMutation(userId, "goals", "goal-in-flight", "create", {
      id: "goal-in-flight",
    });
    const [deferredItem, inFlightItem] = await syncRepo.listPending(userId);
    await syncRepo.deferRetry(deferredItem, "Temporary failure", 60_000);
    await syncRepo.markSyncing(inFlightItem);
    pushSyncMutationsMock.mockImplementation(
      ({ items }: { items: Array<Record<string, unknown>> }) =>
        Promise.resolve(acceptItems(items)),
    );

    const engine = new ReadingCoreSyncEngine();
    const status = await engine.syncUser(userId, { forcePending: true });

    expect(pushSyncMutationsMock).toHaveBeenCalledTimes(1);
    expect(pushSyncMutationsMock.mock.calls[0][0].items).toHaveLength(2);
    expect(status).toMatchObject({ pending: 0, failed: 0, syncing: 0 });
  });

  it("automatically retries an item when its backoff expires", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    getCurrentAuthUserMock.mockResolvedValue({ id: userId });
    await syncRepo.enqueueMutation(userId, "goals", "goal-auto", "create", {
      id: "goal-auto",
    });
    pushSyncMutationsMock
      .mockImplementationOnce(({ items }: { items: Array<Record<string, unknown>> }) =>
        Promise.resolve({
          accepted: [],
          failed: items.map((item) => ({
            id: item.id,
            client_mutation_id: item.client_mutation_id,
            entity: item.entity,
            client_entity_id: item.client_entity_id,
            error: "Service temporarily unavailable",
            retryable: true,
          })),
          cursor: "2026-07-01T00:00:00.000Z",
        }),
      )
      .mockImplementation(
        ({ items }: { items: Array<Record<string, unknown>> }) =>
          Promise.resolve(acceptItems(items)),
    );

    let retryCallback: (() => void | Promise<void>) | null = null;
    let retryDelayMs: number | null = null;
    const engine = new ReadingCoreSyncEngine({
      setTimeout: (callback, delayMs) => {
        retryCallback = callback;
        retryDelayMs = delayMs;
        return 1;
      },
      clearTimeout: vi.fn(),
    });
    const deferred = await engine.syncUser(userId);
    expect(deferred.pending).toBe(1);
    expect(pushSyncMutationsMock).toHaveBeenCalledTimes(1);

    expect(retryCallback).not.toBeNull();
    expect(retryDelayMs).toBeGreaterThan(0);
    const [deferredItem] = await syncRepo.listPending(userId);
    await syncRepo.retry(deferredItem); // Simulate reaching the captured timer's deadline.
    await retryCallback?.();

    expect(pushSyncMutationsMock).toHaveBeenCalledTimes(2);
    expect(await syncRepo.listPending(userId)).toEqual([]);
  });

  it("moves permanent item failures to review instead of retrying forever", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    await syncRepo.enqueueMutation(userId, "goals", "goal-invalid", "create", {
      id: "goal-invalid",
    });
    pushSyncMutationsMock.mockImplementation(
      ({ items }: { items: Array<Record<string, unknown>> }) => Promise.resolve({
        accepted: [],
        failed: items.map((item) => ({
          id: item.id,
          client_mutation_id: item.client_mutation_id,
          entity: item.entity,
          client_entity_id: item.client_entity_id,
          error: "Goal payload violates a database constraint",
          retryable: false,
        })),
        cursor: "2026-07-01T00:00:00.000Z",
      }),
    );

    const engine = new ReadingCoreSyncEngine();
    const status = await engine.syncUser(userId);

    expect(status).toMatchObject({ pending: 0, failed: 1, syncing: 0 });
    expect(await syncRepo.listFailed(userId)).toEqual([
      expect.objectContaining({
        client_entity_id: "goal-invalid",
        last_error: "Goal payload violates a database constraint",
      }),
    ]);
  });

  it("keeps a bookshelf schema-cache rollout failure retryable", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const bookId = crypto.randomUUID();
    const originalBook = makeBook({
      id: bookId,
      user_id: userId,
      title: "Supernova",
      shelf_position: null,
    });
    const reorderedBook = {
      ...originalBook,
      shelf_position: 3,
      updated_at: "2026-08-14T12:00:00.000Z",
    };
    await booksRepo.upsertRemote(userId, originalBook);
    await booksRepo.upsertLocal(userId, reorderedBook, "update");
    pushSyncMutationsMock.mockImplementation(
      ({ items }: { items: Array<Record<string, unknown>> }) => Promise.resolve({
        accepted: [],
        failed: items.map((item) => ({
          id: item.id,
          client_mutation_id: item.client_mutation_id,
          entity: item.entity,
          client_entity_id: item.client_entity_id,
          error: "Could not find the 'shelf_position' column of 'books' in the schema cache",
          retryable: false,
        })),
      }),
    );

    const engine = new ReadingCoreSyncEngine({
      setTimeout: () => 1,
      clearTimeout: vi.fn(),
    });
    const status = await engine.syncUser(userId);

    expect(status).toMatchObject({ pending: 1, failed: 0, syncing: 0 });
    expect(await syncRepo.listFailed(userId)).toEqual([]);
    expect(await syncRepo.listPending(userId)).toEqual([
      expect.objectContaining({
        client_entity_id: bookId,
        attempt_count: 1,
        last_error: "Could not find the 'shelf_position' column of 'books' in the schema cache",
      }),
    ]);
  });

  it("automatically requeues a persisted bookshelf schema-cache failure", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const bookId = crypto.randomUUID();
    const originalBook = makeBook({
      id: bookId,
      user_id: userId,
      title: "Supernova",
      shelf_position: null,
    });
    const reorderedBook = {
      ...originalBook,
      shelf_position: 4,
      updated_at: "2026-08-14T12:01:00.000Z",
    };
    await booksRepo.upsertRemote(userId, originalBook);
    await booksRepo.upsertLocal(userId, reorderedBook, "update");
    const [pendingItem] = await syncRepo.listPending(userId);
    await syncRepo.markFailed(
      pendingItem,
      "Could not find the 'shelf_position' column of 'books' in the schema cache",
    );
    pushSyncMutationsMock.mockImplementation(
      ({ items }: { items: Array<Record<string, unknown>> }) => Promise.resolve({
        accepted: items.map((item) => ({
          id: item.id,
          client_mutation_id: item.client_mutation_id,
          entity: item.entity,
          client_entity_id: item.client_entity_id,
          server_entity_id: bookId,
          record: reorderedBook,
        })),
        failed: [],
      }),
    );

    const status = await new ReadingCoreSyncEngine().syncUser(userId);

    expect(pushSyncMutationsMock).toHaveBeenCalledTimes(1);
    expect(status).toMatchObject({ pending: 0, failed: 0, syncing: 0 });
    expect(await syncRepo.listFailed(userId)).toEqual([]);
    expect(await syncRepo.listPending(userId)).toEqual([]);
    expect(await booksRepo.get(bookId)).toMatchObject({ shelf_position: 4 });
  });

  it("returns in-flight items to pending when the server response is malformed", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    await syncRepo.enqueueMutation(userId, "goals", "goal-malformed", "create", {
      id: "goal-malformed",
    });
    pushSyncMutationsMock.mockResolvedValue({ success: false });

    const engine = new ReadingCoreSyncEngine({
      setTimeout: () => 1,
      clearTimeout: vi.fn(),
    });
    await expect(engine.syncUser(userId)).rejects.toThrow("invalid response");

    expect(await syncRepo.counts(userId)).toEqual({ pending: 1, failed: 0, syncing: 0 });
  });

  it("does not acknowledge an accepted result whose identity does not match the source mutation", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    await syncRepo.enqueueMutation(userId, "goals", "goal-mismatched-ack", "create", {
      id: "goal-mismatched-ack",
    });
    pushSyncMutationsMock.mockImplementation(
      ({ items }: { items: Array<Record<string, unknown>> }) => {
        const [item] = items;
        return Promise.resolve({
          accepted: [{
            id: item.id,
            client_mutation_id: "a-different-mutation",
            entity: item.entity,
            client_entity_id: item.client_entity_id,
            server_entity_id: item.client_entity_id,
            record: {
              id: item.client_entity_id,
              user_id: item.user_id,
            },
          }],
          failed: [],
        });
      },
    );

    const engine = new ReadingCoreSyncEngine({
      setTimeout: () => 1,
      clearTimeout: vi.fn(),
    });
    const status = await engine.syncUser(userId);

    expect(status).toMatchObject({ pending: 1, failed: 0, syncing: 0 });
    expect(await syncRepo.listPending(userId)).toEqual([
      expect.objectContaining({
        client_entity_id: "goal-mismatched-ack",
        attempt_count: 1,
        last_error: "Sync server returned no result",
      }),
    ]);
  });

  it("does not apply a failure whose identity does not match the source mutation", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    await syncRepo.enqueueMutation(userId, "goals", "goal-mismatched-failure", "create", {
      id: "goal-mismatched-failure",
    });
    pushSyncMutationsMock.mockImplementation(
      ({ items }: { items: Array<Record<string, unknown>> }) => {
        const [item] = items;
        return Promise.resolve({
          accepted: [],
          failed: [{
            id: item.id,
            client_mutation_id: item.client_mutation_id,
            entity: "books",
            client_entity_id: item.client_entity_id,
            error: "Permanent but for the wrong mutation",
            retryable: false,
          }],
        });
      },
    );

    const engine = new ReadingCoreSyncEngine({
      setTimeout: () => 1,
      clearTimeout: vi.fn(),
    });
    const status = await engine.syncUser(userId);

    expect(status).toMatchObject({ pending: 1, failed: 0, syncing: 0 });
    expect(await syncRepo.listFailed(userId)).toEqual([]);
    expect(await syncRepo.listPending(userId)).toEqual([
      expect.objectContaining({
        client_entity_id: "goal-mismatched-failure",
        attempt_count: 1,
      }),
    ]);
  });

  it("keeps a book mutation when an accepted result omits its record", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const staleBookId = `stale-${crypto.randomUUID()}`;
    const canonicalBookId = crypto.randomUUID();
    const localBook = makeBook({
      id: staleBookId,
      user_id: userId,
      title: "Supernova",
      isbn: "9781250078391",
    });
    await booksRepo.upsertLocal(userId, localBook, "create");
    pushSyncMutationsMock.mockImplementation(
      ({ items }: { items: Array<Record<string, unknown>> }) => {
        const [item] = items;
        return Promise.resolve({
          accepted: [{
            id: item.id,
            client_mutation_id: item.client_mutation_id,
            entity: item.entity,
            client_entity_id: item.client_entity_id,
            server_entity_id: canonicalBookId,
          }],
          failed: [],
        });
      },
    );

    const engine = new ReadingCoreSyncEngine({
      setTimeout: () => 1,
      clearTimeout: vi.fn(),
    });
    const status = await engine.syncUser(userId);

    expect(status).toMatchObject({ pending: 1, failed: 0, syncing: 0 });
    expect(await booksRepo.get(staleBookId)).toMatchObject({ title: "Supernova" });
    expect(await booksRepo.get(canonicalBookId)).toBeNull();
    expect(await syncRepo.listPending(userId)).toEqual([
      expect.objectContaining({
        client_entity_id: staleBookId,
        attempt_count: 1,
        last_error: "Sync server returned an accepted change without a valid record",
      }),
    ]);
  });

  it("keeps a book mutation when its accepted record id contains surrounding whitespace", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const staleBookId = `stale-${crypto.randomUUID()}`;
    const canonicalBookId = crypto.randomUUID();
    const localBook = makeBook({
      id: staleBookId,
      user_id: userId,
      title: "Supernova",
      isbn: "9781250078391",
    });
    await booksRepo.upsertLocal(userId, localBook, "update");
    pushSyncMutationsMock.mockImplementation(
      ({ items }: { items: Array<Record<string, unknown>> }) => {
        const [item] = items;
        return Promise.resolve({
          accepted: [{
            id: item.id,
            client_mutation_id: item.client_mutation_id,
            entity: item.entity,
            client_entity_id: item.client_entity_id,
            server_entity_id: canonicalBookId,
            record: {
              ...localBook,
              id: ` ${canonicalBookId} `,
            },
          }],
          failed: [],
        });
      },
    );

    const engine = new ReadingCoreSyncEngine({
      setTimeout: () => 1,
      clearTimeout: vi.fn(),
    });
    const status = await engine.syncUser(userId);

    expect(status).toMatchObject({ pending: 1, failed: 0, syncing: 0 });
    expect(await booksRepo.get(staleBookId)).toMatchObject({ title: "Supernova" });
    expect(await booksRepo.get(canonicalBookId)).toBeNull();
    expect(await booksRepo.get(` ${canonicalBookId} `)).toBeNull();
    expect(await syncRepo.listPending(userId)).toEqual([
      expect.objectContaining({
        client_entity_id: staleBookId,
        attempt_count: 1,
        last_error: "Sync server returned an accepted change without a valid record id",
      }),
    ]);
  });

  it("keeps a book mutation when its accepted record belongs to another account", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const staleBookId = `stale-${crypto.randomUUID()}`;
    const canonicalBookId = crypto.randomUUID();
    const localBook = makeBook({
      id: staleBookId,
      user_id: userId,
      title: "Supernova",
      isbn: "9781250078391",
    });
    await booksRepo.upsertLocal(userId, localBook, "restore");
    pushSyncMutationsMock.mockImplementation(
      ({ items }: { items: Array<Record<string, unknown>> }) => {
        const [item] = items;
        return Promise.resolve({
          accepted: [{
            id: item.id,
            client_mutation_id: item.client_mutation_id,
            entity: item.entity,
            client_entity_id: item.client_entity_id,
            server_entity_id: canonicalBookId,
            record: {
              ...localBook,
              id: canonicalBookId,
              user_id: `other-${crypto.randomUUID()}`,
            },
          }],
          failed: [],
        });
      },
    );

    const engine = new ReadingCoreSyncEngine({
      setTimeout: () => 1,
      clearTimeout: vi.fn(),
    });
    const status = await engine.syncUser(userId);

    expect(status).toMatchObject({ pending: 1, failed: 0, syncing: 0 });
    expect(await booksRepo.get(staleBookId)).toMatchObject({ user_id: userId });
    expect(await booksRepo.get(canonicalBookId)).toBeNull();
    expect(await syncRepo.listPending(userId)).toEqual([
      expect.objectContaining({
        client_entity_id: staleBookId,
        attempt_count: 1,
        last_error: "Sync server returned a book for a different account",
      }),
    ]);
  });

  it("enriches a stale book update with the canonical local snapshot and remaps the accepted record", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const staleBookId = `stale-${crypto.randomUUID()}`;
    const canonicalBookId = crypto.randomUUID();
    const canonicalBook: Book = {
      id: canonicalBookId,
      user_id: userId,
      title: "Supernova",
      author: "Marissa Meyer",
      isbn: "9781250078391",
      genre: "Science Fiction",
      pages: 560,
      chapters: null,
      cover_url: null,
      description: null,
      status: "to_read",
      tags: null,
      metadata: null,
      current_page: 0,
      date_started: null,
      date_finished: null,
      rating: null,
      notes: null,
      source_provider: null,
      source_id: null,
      shelf_position: 1,
      created_at: "2026-06-19T22:35:40.000Z",
      updated_at: "2026-06-19T22:35:40.000Z",
      deleted_at: null,
    };
    const updatedCanonicalBook = {
      ...canonicalBook,
      status: "reading",
      updated_at: "2026-08-09T12:00:00.000Z",
    };
    await booksRepo.upsertRemote(userId, canonicalBook);
    await syncRepo.enqueueMutation(userId, "books", staleBookId, "update", {
      title: "Supernova",
      author: "Marissa Meyer",
      isbn: "9781250078391",
      status: "reading",
    });
    pushSyncMutationsMock.mockImplementation(
      ({ items }: { items: Array<Record<string, unknown>> }) => Promise.resolve({
        accepted: items.map((item) => ({
          id: item.id,
          client_mutation_id: item.client_mutation_id,
          entity: item.entity,
          client_entity_id: item.client_entity_id,
          server_entity_id: canonicalBookId,
          record: updatedCanonicalBook,
        })),
        failed: [],
        cursor: "2026-08-09T12:00:00.000Z",
      }),
    );

    const engine = new ReadingCoreSyncEngine();
    await engine.syncUser(userId, { forcePending: true });

    const pushedPayload = pushSyncMutationsMock.mock.calls[0][0].items[0].payload;
    expect(pushedPayload).toMatchObject({
      title: "Supernova",
      author: "Marissa Meyer",
      isbn: "9781250078391",
      status: "reading",
      __sync_snapshot: {
        id: canonicalBookId,
        title: "Supernova",
        isbn: "9781250078391",
        status: "reading",
      },
    });
    expect(await syncRepo.listPending(userId)).toEqual([]);
    expect(await syncRepo.listFailed(userId)).toEqual([]);
    expect(await booksRepo.get(canonicalBookId)).toMatchObject({ status: "reading" });
    expect(await booksRepo.get(staleBookId)).toBeNull();
  });

  it("keeps a newer same-book edit queued while the in-flight edit is acknowledged and pulled", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const bookId = crypto.randomUUID();
    const originalBook = makeBook({
      id: bookId,
      user_id: userId,
      title: "Supernova",
      notes: "Original note",
    });
    const firstEdit = {
      ...originalBook,
      notes: "First edit",
      updated_at: "2026-08-10T10:00:00.000Z",
    };
    const newerEdit = {
      ...firstEdit,
      notes: "Newer edit while syncing",
      updated_at: "2026-08-10T10:01:00.000Z",
    };
    await booksRepo.upsertRemote(userId, originalBook);
    await booksRepo.upsertLocal(userId, firstEdit, "update");

    let releasePush: (() => void) | null = null;
    pushSyncMutationsMock.mockImplementationOnce(
      ({ items }: { items: Array<Record<string, unknown>> }) =>
        new Promise((resolve) => {
          releasePush = () => resolve({
            accepted: items.map((item) => ({
              id: item.id,
              client_mutation_id: item.client_mutation_id,
              entity: item.entity,
              client_entity_id: item.client_entity_id,
              server_entity_id: bookId,
              record: firstEdit,
            })),
            failed: [],
            cursor: "2026-08-10T10:00:00.000Z",
          });
        }),
    );
    pullSyncChangesMock.mockResolvedValue({
      ...emptyPullResponse,
      records: {
        ...emptyPullResponse.records,
        books: [firstEdit],
      },
    });

    const engine = new ReadingCoreSyncEngine();
    const syncing = engine.syncUser(userId);
    await vi.waitFor(() => expect(pushSyncMutationsMock).toHaveBeenCalledTimes(1));
    await booksRepo.upsertLocal(userId, newerEdit, "update");
    releasePush?.();
    await syncing;

    expect(await booksRepo.get(bookId)).toMatchObject({ notes: "Newer edit while syncing" });
    expect((await booksRepo.listRecords(userId))[0]).toMatchObject({ status: "pending" });
    expect(await syncRepo.listPending(userId)).toEqual([
      expect.objectContaining({
        client_entity_id: bookId,
        payload: expect.objectContaining({ notes: "Newer edit while syncing" }),
      }),
    ]);
    expect(emitBooksChangedMock).toHaveBeenCalledWith({
      type: "upsert",
      userId,
      book: expect.objectContaining({ notes: "Newer edit while syncing" }),
    });
  });

  it("preserves unsynced dependent records when the immediate pull contains older copies", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const bookId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const progressId = crypto.randomUUID();
    const journalId = crypto.randomUUID();
    const updatedAt = "2026-08-10T12:00:00.000Z";
    await localDriver.upsertRecord("reading_sessions", {
      id: sessionId,
      user_id: userId,
      data: {
        id: sessionId,
        user_id: userId,
        book_id: bookId,
        start_time: updatedAt,
        end_time: null,
        duration: null,
        client_session_id: sessionId,
        created_at: updatedAt,
      },
      status: "pending",
      updated_at: updatedAt,
      deleted_at: null,
      last_synced_at: null,
    });
    await localDriver.upsertRecord("progress_logs", {
      id: progressId,
      user_id: userId,
      data: {
        id: progressId,
        user_id: userId,
        book_id: bookId,
        page_number: 88,
      },
      status: "failed",
      updated_at: updatedAt,
      deleted_at: null,
      last_synced_at: null,
    });
    await localDriver.upsertRecord("journal_entries", {
      id: journalId,
      user_id: userId,
      data: {
        id: journalId,
        user_id: userId,
        book_id: bookId,
        title: "Local thought",
        content: "Keep this",
        created_at: updatedAt,
        updated_at: updatedAt,
        deleted_at: null,
      },
      status: "pending",
      updated_at: updatedAt,
      deleted_at: null,
      last_synced_at: null,
    });
    pullSyncChangesMock.mockResolvedValue({
      ...emptyPullResponse,
      records: {
        ...emptyPullResponse.records,
        reading_sessions: [{
          id: sessionId,
          user_id: userId,
          book_id: bookId,
          start_time: updatedAt,
          end_time: updatedAt,
          duration: 1,
          client_session_id: sessionId,
          created_at: updatedAt,
        }],
        progress_logs: [{
          id: progressId,
          user_id: userId,
          book_id: bookId,
          page_number: 2,
        }],
        journal_entries: [{
          id: journalId,
          user_id: userId,
          book_id: bookId,
          title: "Remote thought",
          content: "Older",
          created_at: updatedAt,
          updated_at: updatedAt,
          deleted_at: null,
        }],
      },
    });

    await new ReadingCoreSyncEngine().syncUser(userId);

    expect(await localDriver.getRecord("reading_sessions", sessionId)).toMatchObject({
      status: "pending",
      data: { end_time: null },
    });
    expect(await localDriver.getRecord("progress_logs", progressId)).toMatchObject({
      status: "failed",
      data: { page_number: 88 },
    });
    expect(await localDriver.getRecord("journal_entries", journalId)).toMatchObject({
      status: "pending",
      data: { title: "Local thought" },
    });
  });

  it("uses an authoritative library copy to clear a confirmed stale update and remap synced local references", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const staleBookId = `stale-${crypto.randomUUID()}`;
    const canonicalBook = makeBook({
      id: crypto.randomUUID(),
      user_id: userId,
      title: "Supernova",
      author: "Marissa Meyer",
      isbn: "9781250078391",
    });
    const unrelatedBook = makeBook({
      id: crypto.randomUUID(),
      user_id: userId,
      title: "Cinder",
      author: "Marissa Meyer",
      isbn: "9781250007209",
    });
    const staleBook = makeBook({
      ...canonicalBook,
      id: staleBookId,
      status: "reading",
      notes: "A local edit that was never synced",
    });
    const progressId = crypto.randomUUID();
    await booksRepo.upsertRemote(userId, staleBook);
    await progressRepo.upsertRemote(userId, {
      id: progressId,
      user_id: userId,
      book_id: staleBookId,
      page_number: 42,
    });
    await syncRepo.enqueueMutation(userId, "books", staleBookId, "update", {
      title: staleBook.title,
      author: staleBook.author,
      isbn: staleBook.isbn,
      notes: staleBook.notes,
    });
    const [pendingItem] = await syncRepo.listPending(userId);
    await syncRepo.markFailed(pendingItem, "Book already exists in your library");
    const [failedItem] = await syncRepo.listFailed(userId);
    getCurrentAuthUserMock.mockResolvedValue({ id: userId });
    fetchUserBooksPageMock
      .mockResolvedValueOnce({ books: [unrelatedBook], hasMore: true })
      .mockResolvedValueOnce({ books: [canonicalBook], hasMore: false });

    const engine = new ReadingCoreSyncEngine();
    const result = await engine.useServerBookCopy(failedItem);

    expect(fetchUserBooksPageMock).toHaveBeenCalledWith(userId, 0, 100);
    expect(fetchUserBooksPageMock).toHaveBeenCalledWith(userId, 1, 100);
    expect(result).toMatchObject({
      book: { id: canonicalBook.id, title: "Supernova" },
      status: { pending: 0, failed: 0, syncing: 0 },
    });
    expect(await booksRepo.get(staleBookId)).toBeNull();
    expect(await booksRepo.get(canonicalBook.id)).toEqual(canonicalBook);
    expect(await progressRepo.get(progressId)).toMatchObject({ book_id: canonicalBook.id });
    expect(await syncRepo.listFailed(userId)).toEqual([]);
    expect(emitBooksChangedMock).toHaveBeenCalledWith({
      type: "remove",
      userId,
      bookId: staleBookId,
    });
    expect(emitBooksChangedMock).toHaveBeenCalledWith({
      type: "upsert",
      userId,
      book: canonicalBook,
    });
  });

  it("does not offer destructive cleanup while a pending import references the stale book", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const staleBook = makeBook({
      id: `stale-${crypto.randomUUID()}`,
      user_id: userId,
      title: "Supernova",
      author: "Marissa Meyer",
      isbn: "9781250078391",
    });
    await booksRepo.upsertRemote(userId, staleBook);
    await pendingBookImportsRepo.upsert(userId, {
      id: crypto.randomUUID(),
      user_id: userId,
      isbn: staleBook.isbn,
      query: staleBook.title,
      source: "manual",
      status: "resolved",
      resolved_book_id: staleBook.id,
      last_error: null,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
    });
    await syncRepo.enqueueMutation(userId, "books", staleBook.id, "update", staleBook);
    const [pendingItem] = await syncRepo.listPending(userId);
    await syncRepo.markFailed(pendingItem, "Book already exists in your library");
    const [failedItem] = await syncRepo.listFailed(userId);

    const safety = await new ReadingCoreSyncEngine().getServerBookCopySafety(failedItem);

    expect(safety).toEqual({ safe: false, relatedChangeCount: 1 });
  });

  it("keeps the local change when no matching authoritative library copy exists", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const staleBook = makeBook({
      id: `stale-${crypto.randomUUID()}`,
      user_id: userId,
      title: "Supernova",
      author: "Marissa Meyer",
      isbn: "9781250078391",
    });
    await booksRepo.upsertRemote(userId, staleBook);
    await syncRepo.enqueueMutation(userId, "books", staleBook.id, "update", staleBook);
    const [pendingItem] = await syncRepo.listPending(userId);
    await syncRepo.markFailed(pendingItem, "Book already exists in your library");
    const [failedItem] = await syncRepo.listFailed(userId);
    getCurrentAuthUserMock.mockResolvedValue({ id: userId });

    const engine = new ReadingCoreSyncEngine();
    await expect(engine.useServerBookCopy(failedItem)).rejects.toThrow(
      "matching synced library copy could not be found",
    );

    expect(await booksRepo.get(staleBook.id)).toEqual(staleBook);
    expect(await syncRepo.listFailed(userId)).toHaveLength(1);
    expect(emitBooksChangedMock).not.toHaveBeenCalled();
  });

  it("aborts cleanup when a dependent mutation appears during the authoritative lookup", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const staleBook = makeBook({
      id: `stale-${crypto.randomUUID()}`,
      user_id: userId,
      title: "Supernova",
      author: "Marissa Meyer",
      isbn: "9781250078391",
    });
    const canonicalBook = makeBook({ ...staleBook, id: crypto.randomUUID() });
    await booksRepo.upsertRemote(userId, staleBook);
    await syncRepo.enqueueMutation(userId, "books", staleBook.id, "update", staleBook);
    const [pendingItem] = await syncRepo.listPending(userId);
    await syncRepo.markFailed(pendingItem, "Book already exists in your library");
    const [failedItem] = await syncRepo.listFailed(userId);
    getCurrentAuthUserMock.mockResolvedValue({ id: userId });
    fetchUserBooksPageMock.mockImplementation(async () => {
      await syncRepo.enqueueMutation(userId, "progress_logs", crypto.randomUUID(), "create", {
        book_id: staleBook.id,
        page_number: 80,
      });
      return { books: [canonicalBook], hasMore: false };
    });

    const engine = new ReadingCoreSyncEngine();
    await expect(engine.useServerBookCopy(failedItem)).rejects.toThrow(
      "appeared while the library copy was loading",
    );

    expect(await booksRepo.get(staleBook.id)).toEqual(staleBook);
    expect(await booksRepo.get(canonicalBook.id)).toBeNull();
    expect(await syncRepo.listFailed(userId)).toHaveLength(1);
    expect(await syncRepo.listPending(userId)).toHaveLength(1);
  });
});
