import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";
import { BookEditorValidationError } from "@/lib/bookEditor";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), commit: vi.fn(), sync: vi.fn(), online: vi.fn(),
  emit: vi.fn(), invalidate: vi.fn(), info: vi.fn() }));
vi.mock("@/services/api", () => ({ getCurrentAuthUser: mocks.auth, emitBooksChanged: mocks.emit, invalidateBooksCache: mocks.invalidate }));
vi.mock("@/services/local", () => ({ booksRepo: { get: mocks.get, upsertLocal: mocks.commit }, journalRepo: {}, createLocalId: () => "id" }));
vi.mock("@/services/sync/engine", () => ({ readingCoreSync: { syncUser: mocks.sync } }));
vi.mock("@/services/connectivity", () => ({ isConnectivityAvailable: mocks.online }));
vi.mock("@/services/telemetry", () => ({ trackCoreEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { info: mocks.info } }));
import { bookOperations } from "./offlineOperation";

const existing = { id: "book", user_id: "reader", title: "Old title", current_page: 150, pages: 200, chapters: null,
  date_started: "2026-09-01", date_finished: null, deleted_at: null, metadata: { preserved: true } } as unknown as Book;
const options = { expectedUserId: "reader", isCurrent: () => true };
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: "reader" }); mocks.get.mockResolvedValue(existing);
  mocks.commit.mockResolvedValue(undefined); mocks.sync.mockResolvedValue(undefined); mocks.online.mockReturnValue(true);
});
describe("book metadata local commit", () => {
  it("merges only changed metadata against the latest saved reading place", async () => {
    await bookOperations.update("book", { title: "New title" }, options);
    expect(mocks.commit).toHaveBeenCalledExactlyOnceWith("reader", { ...existing, title: "New title", updated_at: expect.any(String) }, "update");
  });
  it("rejects a cross-field conflict against the latest record before writing", async () => {
    await expect(bookOperations.update("book", { pages: 100 }, options)).rejects.toBeInstanceOf(BookEditorValidationError);
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("returns the latest record with a conflict so the editor can expose its new reading place", async () => {
    await expect(bookOperations.update("book", { pages: 100 }, options)).rejects.toMatchObject({ latestBook: existing, fields: { current_page: expect.any(String) } });
  });
  it.each(["owner", "deleted", "identity"])("refuses an invalid %s record", async kind => {
    mocks.get.mockResolvedValue({ ...existing, ...(kind === "owner" ? { user_id: "other" } : kind === "deleted" ? { deleted_at: "2026-10-01" } : { id: "different" }) });
    await expect(bookOperations.update("book", { title: "New title" }, options)).rejects.toThrow();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("does not transfer a stale edit into another authenticated account", async () => {
    mocks.auth.mockResolvedValue({ id: "other" });
    await expect(bookOperations.update("book", { title: "New title" }, options)).rejects.toThrow("another reader");
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it.each(["auth", "get"])("invalidates an obsolete editor after the asynchronous %s boundary", async boundary => {
    let current = true;
    mocks[boundary].mockImplementation(async () => { current = false; return boundary === "auth" ? { id: "reader" } : existing; });
    await expect(bookOperations.update("book", { title: "New title" }, { ...options, isCurrent: () => current })).rejects.toThrow("no longer active");
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it.each([{ id: "different" }, { user_id: "other" }])("does not let a patch change identity or ownership", async patch => {
    await expect(bookOperations.update("book", patch)).rejects.toThrow();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("waits for local durability and keeps a local failure retryable", async () => {
    mocks.commit.mockRejectedValue(new Error("Outbox unavailable"));
    await expect(bookOperations.update("book", { title: "New title" }, options)).rejects.toThrow("Outbox unavailable");
    expect(mocks.emit).not.toHaveBeenCalled(); expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("does not turn postcommit failures into a rejected save", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.invalidate.mockImplementation(() => { throw new Error("Cache failure"); });
    mocks.emit.mockImplementation(() => { throw new Error("Event failure"); });
    mocks.sync.mockImplementation(() => { throw new Error("Sync failure"); });
    try {
      await expect(bookOperations.update("book", { title: "New title" }, options)).resolves.toBeUndefined();
      expect(mocks.commit).toHaveBeenCalledOnce(); expect(logger).toHaveBeenCalledTimes(3);
    } finally { logger.mockRestore(); }
  });
  it("preserves the existing unguarded caller signature while rejecting cross-owner records", async () => {
    await bookOperations.update("book", { status: "completed" });
    expect(mocks.commit).toHaveBeenCalledOnce();
    mocks.get.mockResolvedValue({ ...existing, user_id: "other" });
    await expect(bookOperations.update("book", { status: "reading" })).rejects.toThrow("another reader");
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
});
