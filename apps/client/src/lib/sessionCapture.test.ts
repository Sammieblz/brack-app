import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";
import { createSessionCapture, ObsoleteSessionCapture, persistSessionCapture, restoreSessionCapture } from "./sessionCapture";

const repository = vi.hoisted(() => ({ resolve: vi.fn(), bookGet: vi.fn(), bookWrite: vi.fn(), sessionGet: vi.fn(), sessionList: vi.fn(), sessionWrite: vi.fn() }));
vi.mock("@/services/local", () => ({ booksRepo: { resolveIdentity: repository.resolve, get: repository.bookGet, upsertLocal: repository.bookWrite },
  sessionsRepo: { get: repository.sessionGet, listRecords: repository.sessionList, createPending: repository.sessionWrite }, createLocalId: () => "new-session" }));
const book = { id: "book", user_id: "reader", title: "A book", status: "to_read", date_started: null, deleted_at: null, current_page: 42 } as Book;
const fresh = () => createSessionCapture({ userId: "reader", bookId: "old-book", bookTitle: book.title,
  startTime: new Date(2026, 9, 1, 23, 50), endTime: new Date(2026, 9, 2, 0, 0), durationMinutes: 10,
  clientSessionId: "session", showJournalPrompt: true });
beforeEach(() => {
  repository.resolve.mockReset().mockResolvedValue("book");
  repository.bookGet.mockReset().mockResolvedValue(book);
  repository.bookWrite.mockReset().mockResolvedValue(undefined);
  repository.sessionGet.mockReset().mockResolvedValue(null);
  repository.sessionList.mockReset().mockResolvedValue([]);
  repository.sessionWrite.mockReset().mockResolvedValue(undefined);
});
describe("one owned timer completion", () => {
  it("resolves the owned book and records the existing start-date rule", async () => {
    const attempt = fresh();
    const result = await persistSessionCapture(attempt, () => true);
    expect(result).toMatchObject({ status: "reading", date_started: "2026-10-01", current_page: 42 });
    expect(repository.sessionWrite).toHaveBeenCalledExactlyOnceWith("reader", expect.objectContaining({ id: "session", book_id: "book", duration: 10 }));
  });
  it.each([null, { ...book, user_id: "other" }, { ...book, deleted_at: "2026-10-01" }])("rejects unavailable books before creating a session", async value => {
    repository.bookGet.mockResolvedValue(value);
    await expect(persistSessionCapture(fresh(), () => true)).rejects.toThrow(/no longer available/);
    expect(repository.sessionWrite).not.toHaveBeenCalled();
  });
  it.each([0, -1, 721, 1.5, NaN])("rejects invalid duration %s", async duration => {
    const attempt = fresh(); attempt.session.duration = duration;
    await expect(persistSessionCapture(attempt, () => true)).rejects.toThrow(/whole number/);
    expect(repository.sessionWrite).not.toHaveBeenCalled();
  });
  it("retries only the remaining book update with latest local fields", async () => {
    const attempt = fresh();
    repository.bookWrite.mockRejectedValueOnce(new Error("Book write failed"));
    await expect(persistSessionCapture(attempt, () => true)).rejects.toThrow("Book write failed");
    repository.bookGet.mockResolvedValue({ ...book, notes: "Latest notes", current_page: 90 });
    const result = await persistSessionCapture(attempt, () => true);
    expect(repository.sessionWrite).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ notes: "Latest notes", current_page: 90 });
  });
  it("reads back a lost session create response", async () => {
    const attempt = fresh();
    repository.sessionWrite.mockRejectedValueOnce(new Error("Bridge response lost"));
    repository.sessionGet.mockResolvedValueOnce(null).mockImplementation(async () => ({ ...attempt.session }));
    await persistSessionCapture(attempt, () => true);
    expect(repository.sessionWrite).toHaveBeenCalledOnce();
    expect(attempt.sessionCommitted).toBe(true);
  });
  it("keeps uncertain session identity until readback can verify it", async () => {
    const attempt = fresh();
    repository.sessionWrite.mockRejectedValueOnce(new Error("Bridge response lost"));
    repository.sessionGet.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Read unavailable"));
    await expect(persistSessionCapture(attempt, () => true)).rejects.toThrow("Read unavailable");
    expect(attempt.sessionAttempted).toBe(true);
    repository.sessionGet.mockResolvedValue({ ...attempt.session });
    await persistSessionCapture(attempt, () => true);
    expect(repository.sessionWrite).toHaveBeenCalledOnce();
  });
  it("does not repeat a book update whose bridge response was lost", async () => {
    const attempt = fresh();
    repository.bookWrite.mockRejectedValueOnce(new Error("Response lost"));
    await expect(persistSessionCapture(attempt, () => true)).rejects.toThrow("Response lost");
    repository.bookGet.mockResolvedValue(repository.bookWrite.mock.calls[0][1]);
    await persistSessionCapture(attempt, () => true);
    expect(repository.bookWrite).toHaveBeenCalledOnce();
    expect(repository.sessionWrite).toHaveBeenCalledOnce();
  });
  it("persists recency for an already-started reading book instead of emitting a phantom update", async () => {
    const attempt = fresh();
    repository.bookGet.mockResolvedValue({ ...book, status: "reading", date_started: "2026-09-01", updated_at: "2026-09-01T00:00:00Z" });
    const updated = await persistSessionCapture(attempt, () => true);
    expect(repository.bookWrite).toHaveBeenCalledExactlyOnceWith("reader", updated, "update");
    expect(updated.updated_at).toBe(attempt.session.created_at);
    expect(updated.current_page).toBe(42);
  });
  it("preserves a newer book timestamp and returns that actual stored record", async () => {
    const latest = { ...book, status: "reading", date_started: "2026-09-01", updated_at: "2099-01-01T00:00:00Z" };
    repository.bookGet.mockResolvedValue(latest);
    const updated = await persistSessionCapture(fresh(), () => true);
    expect(repository.bookWrite).not.toHaveBeenCalled();
    expect(updated).toBe(latest);
  });
  it("uses the frozen save time for a reviewed historical session", async () => {
    const attempt = fresh();
    attempt.session.created_at = "2026-10-10T12:00:00Z";
    attempt.session.end_time = "2026-10-02T00:00:00Z";
    repository.bookGet.mockResolvedValue({ ...book, status: "reading", date_started: "2026-09-01", updated_at: "2026-10-09T00:00:00Z" });
    const updated = await persistSessionCapture(attempt, () => true);
    expect(updated.updated_at).toBe("2026-10-10T12:00:00Z");
    const restored = restoreSessionCapture(JSON.parse(JSON.stringify(attempt)), "reader")!;
    repository.sessionGet.mockResolvedValue(attempt.session);
    repository.bookGet.mockResolvedValue(updated);
    await persistSessionCapture(restored, () => true);
    expect(repository.bookWrite).toHaveBeenCalledOnce();
  });
  it("rejects identity collisions instead of treating another payload as this session", async () => {
    const attempt = fresh();
    repository.sessionGet.mockResolvedValue({ ...attempt.session, book_id: "book", duration: 11 });
    await expect(persistSessionCapture(attempt, () => true)).rejects.toThrow(/could not be verified/);
    expect(repository.sessionWrite).not.toHaveBeenCalled();
  });
  it("recognizes a synced canonical row ID and equivalent timestamp formatting", async () => {
    const attempt = fresh();
    repository.sessionList.mockResolvedValue([{ id: "server-session", user_id: "reader", status: "synced", deleted_at: null,
      data: { ...attempt.session, id: "server-session", book_id: "book",
        start_time: attempt.session.start_time!.replace(".000Z", "+00:00"), end_time: attempt.session.end_time!.replace(".000Z", "+00:00") } }]);
    await persistSessionCapture(attempt, () => true);
    expect(repository.sessionWrite).not.toHaveBeenCalled(); expect(attempt.savedSessionId).toBe("server-session");
  });
  it.each(["direct", "canonical", "remembered"])("rejects a deleted %s session before any retry writes", async kind => {
    const attempt = fresh();
    if (kind === "remembered") attempt.sessionCommitted = true;
    const id = kind === "canonical" ? "server-session" : attempt.session.id;
    const record = { ...attempt.session, id, book_id: "book", deleted_at: "2026-10-02T12:00:00Z" };
    if (kind === "direct") repository.sessionGet.mockResolvedValue(record);
    repository.sessionList.mockResolvedValue([{ id, user_id: "reader", status: "deleted", deleted_at: record.deleted_at, data: record }]);
    await expect(persistSessionCapture(attempt, () => true)).rejects.toThrow(/session was deleted/);
    expect(repository.sessionWrite).not.toHaveBeenCalled(); expect(repository.bookWrite).not.toHaveBeenCalled();
  });
  it("restores the exact payload, verifies local storage again, and rejects another owner", () => {
    const attempt = fresh(); attempt.sessionCommitted = true; attempt.bookCommitted = true;
    const restored = restoreSessionCapture(JSON.parse(JSON.stringify(attempt)), "reader");
    expect(restored).toMatchObject({ session: attempt.session, sessionAttempted: true, sessionCommitted: false, bookCommitted: false });
    expect(restoreSessionCapture(attempt, "other")).toBeNull();
  });
  it("stops follow-up writes when ownership changes after a session commit", async () => {
    let current = true;
    repository.sessionWrite.mockImplementation(async () => { current = false; });
    await expect(persistSessionCapture(fresh(), () => current)).rejects.toBeInstanceOf(ObsoleteSessionCapture);
    expect(repository.bookWrite).not.toHaveBeenCalled();
  });
});
