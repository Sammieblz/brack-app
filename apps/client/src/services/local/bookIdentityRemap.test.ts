import { describe, expect, it } from "vitest";
import type { Book } from "@/types";
import { localDriver } from "./driver";
import { booksRepo, syncRepo } from "./repositories";

const makeBook = (
  userId: string,
  id: string,
  overrides: Partial<Book> = {},
): Book => ({
  id,
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
  shelf_position: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

const putReference = (
  table: "reading_sessions" | "progress_logs" | "journal_entries" | "book_list_items",
  userId: string,
  id: string,
  bookId: string,
  status: "synced" | "pending" | "failed" | "deleted",
) => localDriver.upsertRecord(table, {
  id,
  user_id: userId,
  data: { id, user_id: userId, book_id: bookId },
  status,
  updated_at: "2026-08-02T00:00:00.000Z",
  deleted_at: status === "deleted" ? "2026-08-02T00:00:00.000Z" : null,
  last_synced_at: status === "synced" ? "2026-08-01T00:00:00.000Z" : null,
});

describe("atomic local book identity remap", () => {
  it("installs the canonical record when neither local identity exists", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const staleBookId = crypto.randomUUID();
    const canonicalBook = makeBook(userId, crypto.randomUUID());

    await booksRepo.remapIdentity(userId, staleBookId, canonicalBook);

    expect(await booksRepo.get(staleBookId)).toBeNull();
    expect(await booksRepo.get(canonicalBook.id)).toEqual(canonicalBook);
    expect(await booksRepo.resolveIdentity(userId, staleBookId)).toBe(canonicalBook.id);
    expect((await localDriver.getRecord("books", canonicalBook.id))?.status).toBe("synced");
  });

  it("remaps a lone stale book, every dependent record, and outstanding payload without changing statuses", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const staleBookId = crypto.randomUUID();
    const canonicalBook = makeBook(userId, crypto.randomUUID(), {
      status: "reading",
      updated_at: "2026-08-03T00:00:00.000Z",
    });
    const staleBook = makeBook(userId, staleBookId, {
      notes: "A newer local note",
      updated_at: "2026-08-04T00:00:00.000Z",
    });
    await localDriver.upsertRecord("books", {
      id: staleBookId,
      user_id: userId,
      data: staleBook,
      status: "pending",
      updated_at: staleBook.updated_at,
      deleted_at: null,
      last_synced_at: "2026-08-01T00:00:00.000Z",
    });

    const sessionId = crypto.randomUUID();
    const progressId = crypto.randomUUID();
    const journalId = crypto.randomUUID();
    const listItemId = crypto.randomUUID();
    await putReference("reading_sessions", userId, sessionId, staleBookId, "pending");
    await putReference("progress_logs", userId, progressId, staleBookId, "failed");
    await putReference("journal_entries", userId, journalId, staleBookId, "deleted");
    await putReference("book_list_items", userId, listItemId, staleBookId, "synced");
    const pendingImportId = crypto.randomUUID();
    await localDriver.upsertRecord("pending_book_imports", {
      id: pendingImportId,
      user_id: userId,
      data: {
        id: pendingImportId,
        user_id: userId,
        resolved_book_id: staleBookId,
      },
      status: "synced",
      updated_at: "2026-08-02T00:00:00.000Z",
      deleted_at: null,
      last_synced_at: "2026-08-02T00:00:00.000Z",
    });

    await syncRepo.enqueueMutation(userId, "books", staleBookId, "update", {
      id: staleBookId,
      notes: "Accepted edit",
    });
    const source = (await syncRepo.listPending(userId))[0];
    await syncRepo.markSyncing(source);

    await syncRepo.enqueueMutation(userId, "books", staleBookId, "update", {
      id: staleBookId,
      notes: "A newer local note",
      __sync_snapshot: { id: staleBookId, title: staleBook.title },
    });
    await syncRepo.enqueueMutation(userId, "progress_logs", progressId, "update", {
      book_id: staleBookId,
      page_number: 72,
    });
    await syncRepo.enqueueMutation(userId, "book_lists", crypto.randomUUID(), "reorder", {
      ordered_book_ids: [crypto.randomUUID(), staleBookId],
    });
    const outstandingBefore = await localDriver.listOutbox(userId, [
      "pending",
      "syncing",
      "failed",
    ]);
    const progressMutation = outstandingBefore.find((item) => item.entity === "progress_logs")!;
    const reorderMutation = outstandingBefore.find((item) => item.operation === "reorder")!;
    await syncRepo.markFailed(progressMutation, "Temporary progress conflict");
    await syncRepo.markSyncing(reorderMutation);

    await booksRepo.remapIdentity(userId, staleBookId, canonicalBook, {
      sourceOutbox: {
        id: source.id,
        clientMutationId: source.client_mutation_id,
        expectedStatus: "syncing",
        expectedAttemptCount: source.attempt_count + 1,
      },
    });

    expect(await booksRepo.get(staleBookId)).toBeNull();
    expect(await booksRepo.resolveIdentity(userId, staleBookId)).toBe(canonicalBook.id);
    const canonicalRecord = await localDriver.getRecord<Book>("books", canonicalBook.id);
    expect(canonicalRecord).toMatchObject({
      id: canonicalBook.id,
      status: "pending",
      last_synced_at: "2026-08-01T00:00:00.000Z",
      data: {
        id: canonicalBook.id,
        user_id: userId,
        notes: "A newer local note",
      },
    });

    for (const [table, id, status] of [
      ["reading_sessions", sessionId, "pending"],
      ["progress_logs", progressId, "failed"],
      ["journal_entries", journalId, "deleted"],
      ["book_list_items", listItemId, "synced"],
    ] as const) {
      expect(await localDriver.getRecord<Record<string, unknown>>(table, id)).toMatchObject({
        status,
        data: { book_id: canonicalBook.id },
      });
    }
    expect(await localDriver.getRecord("pending_book_imports", pendingImportId)).toMatchObject({
      status: "synced",
      data: { resolved_book_id: canonicalBook.id },
    });

    const outstanding = await localDriver.listOutbox(userId, ["pending", "syncing", "failed"]);
    expect(outstanding.find((item) => item.id === source.id)).toBeUndefined();
    expect(outstanding.find((item) => item.entity === "books")).toMatchObject({
      client_entity_id: canonicalBook.id,
      status: "pending",
      payload: {
        id: canonicalBook.id,
        __sync_snapshot: { id: canonicalBook.id },
      },
    });
    expect(outstanding.find((item) => item.entity === "progress_logs")).toMatchObject({
      status: "failed",
      payload: { book_id: canonicalBook.id },
    });
    expect(outstanding.find((item) => item.operation === "reorder")).toMatchObject({
      status: "syncing",
      payload: { ordered_book_ids: expect.arrayContaining([canonicalBook.id]) },
    });

    const remappedBookMutation = outstanding.find((item) => item.entity === "books")!;
    await syncRepo.markSyncing(remappedBookMutation);
    const latestAcceptedBook = {
      ...canonicalBook,
      notes: "A newer local note",
      updated_at: "2026-08-06T00:00:00.000Z",
    };
    await booksRepo.remapIdentity(userId, staleBookId, latestAcceptedBook, {
      sourceOutbox: {
        id: remappedBookMutation.id,
        clientMutationId: remappedBookMutation.client_mutation_id,
        expectedStatus: "syncing",
        expectedAttemptCount: remappedBookMutation.attempt_count + 1,
      },
    });
    expect(await localDriver.getRecord<Book>("books", canonicalBook.id)).toMatchObject({
      status: "synced",
      data: { notes: "A newer local note" },
    });
  });

  it("preserves an unsynced canonical record instead of replacing it with an accepted snapshot", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const staleBookId = crypto.randomUUID();
    const canonicalBookId = crypto.randomUUID();
    const acceptedBook = makeBook(userId, canonicalBookId, { notes: "Server snapshot" });
    const pendingCanonical = makeBook(userId, canonicalBookId, {
      notes: "New edit on this device",
      updated_at: "2026-08-05T00:00:00.000Z",
    });
    await localDriver.upsertRecord("books", {
      id: canonicalBookId,
      user_id: userId,
      data: pendingCanonical,
      status: "pending",
      updated_at: pendingCanonical.updated_at,
      deleted_at: null,
      last_synced_at: "2026-08-01T00:00:00.000Z",
    });

    await booksRepo.remapIdentity(userId, staleBookId, acceptedBook);

    expect(await localDriver.getRecord<Book>("books", canonicalBookId)).toMatchObject({
      status: "pending",
      data: { notes: "New edit on this device" },
    });
  });

  it("keeps all local state when the source mutation changed before the transaction", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const staleBook = makeBook(userId, crypto.randomUUID());
    const canonicalBook = makeBook(userId, crypto.randomUUID());
    await booksRepo.upsertRemote(userId, staleBook);
    await syncRepo.enqueueMutation(userId, "books", staleBook.id, "update", {
      id: staleBook.id,
      notes: "Keep this edit",
    });
    const source = (await syncRepo.listPending(userId))[0];
    await syncRepo.markFailed(source, "Book already exists in your library");

    await expect(
      booksRepo.remapIdentity(userId, staleBook.id, canonicalBook, {
        sourceOutbox: {
          id: source.id,
          clientMutationId: source.client_mutation_id,
          expectedStatus: "failed",
          expectedAttemptCount: source.attempt_count + 1,
        },
      }),
    ).rejects.toThrow("updated in another tab or sync pass");

    expect(await booksRepo.get(staleBook.id)).toEqual(staleBook);
    expect(await booksRepo.get(canonicalBook.id)).toBeNull();
    expect(await booksRepo.resolveIdentity(userId, staleBook.id)).toBe(staleBook.id);
    expect(await syncRepo.listFailed(userId)).toHaveLength(1);
  });

  it("resolves alias chains without following cycles indefinitely", async () => {
    const userId = `user-${crypto.randomUUID()}`;
    const firstBookId = crypto.randomUUID();
    const secondBookId = crypto.randomUUID();
    const canonicalBookId = crypto.randomUUID();
    const cycleA = crypto.randomUUID();
    const cycleB = crypto.randomUUID();
    const lastSyncedAt = "2026-08-06T00:00:00.000Z";

    await syncRepo.setState({
      key: `${userId}:book_alias:${firstBookId}`,
      user_id: userId,
      cursor: secondBookId,
      last_synced_at: lastSyncedAt,
    });
    await syncRepo.setState({
      key: `${userId}:book_alias:${secondBookId}`,
      user_id: userId,
      cursor: canonicalBookId,
      last_synced_at: lastSyncedAt,
    });
    await syncRepo.setState({
      key: `${userId}:book_alias:${cycleA}`,
      user_id: userId,
      cursor: cycleB,
      last_synced_at: lastSyncedAt,
    });
    await syncRepo.setState({
      key: `${userId}:book_alias:${cycleB}`,
      user_id: userId,
      cursor: cycleA,
      last_synced_at: lastSyncedAt,
    });

    expect(await booksRepo.resolveIdentity(userId, firstBookId)).toBe(canonicalBookId);
    expect(await booksRepo.resolveIdentity(userId, cycleA)).toBe(cycleA);
  });
});
