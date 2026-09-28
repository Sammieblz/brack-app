import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "@/services/api/journal";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  commit: vi.fn(),
  get: vi.fn(),
  sync: vi.fn(),
  online: vi.fn(),
  info: vi.fn(),
}));
vi.mock("@/services/api", () => ({
  getCurrentAuthUser: mocks.auth,
  emitBooksChanged: vi.fn(),
  invalidateBooksCache: vi.fn(),
}));
vi.mock("@/services/local", () => ({
  createLocalId: () => "new-entry",
  booksRepo: {},
  journalRepo: { upsertLocal: mocks.commit, get: mocks.get },
}));
vi.mock("@/services/sync/engine", () => ({ readingCoreSync: { syncUser: mocks.sync } }));
vi.mock("@/services/connectivity", () => ({ isConnectivityAvailable: mocks.online }));
vi.mock("@/services/telemetry", () => ({ trackCoreEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { info: mocks.info } }));
import { journalOperations } from "./offlineOperation";

const existing: JournalEntry = {
  id: "entry",
  user_id: "reader",
  book_id: "book",
  entry_type: "quote",
  content: "A passage",
  content_format: "tiptap",
  content_json: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A passage" }] }] },
  content_html: "<p>A passage</p>",
  photo_url: "https://example.test/reader/old.jpg",
  created_at: "2026-09-27T12:00:00Z",
  updated_at: "2026-09-27T12:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ id: "reader" });
  mocks.online.mockReturnValue(true);
  mocks.sync.mockResolvedValue(undefined);
  mocks.get.mockResolvedValue(existing);
  mocks.commit.mockResolvedValue(undefined);
});

describe("journal local write adapter", () => {
  it("preserves rich content and attachment metadata in the durable create payload", async () => {
    const result = await journalOperations.create({
      ...existing, id: "new-entry", title: "My quote", page_reference: 42, tags: ["reread"],
    });
    expect(result).toMatchObject({
      content_format: existing.content_format,
      content_json: existing.content_json,
      content_html: existing.content_html,
      photo_url: existing.photo_url,
      title: "My quote", page_reference: 42, tags: ["reread"],
    });
    expect(mocks.commit).toHaveBeenCalledExactlyOnceWith("reader", result, "create");
  });

  it("waits for the local commit, not the background synchronization", async () => {
    let commit!: () => void;
    mocks.commit.mockReturnValue(new Promise<void>((resolve) => { commit = resolve; }));
    mocks.sync.mockReturnValue(new Promise<void>(() => undefined));
    const save = journalOperations.create({ book_id: "book", content: "Draft" });
    await vi.waitFor(() => expect(mocks.commit).toHaveBeenCalledOnce());
    expect(mocks.sync).not.toHaveBeenCalled();
    commit();
    await expect(save).resolves.toMatchObject({ id: "new-entry", content: "Draft" });
    expect(mocks.sync).toHaveBeenCalledExactlyOnceWith("reader");
  });

  it("propagates local commit failure without starting sync or claiming an offline save", async () => {
    const failure = new Error("Outbox commit failed");
    mocks.online.mockReturnValue(false);
    mocks.commit.mockRejectedValue(failure);
    await expect(journalOperations.create({ book_id: "book", content: "Keep this draft" }))
      .rejects.toBe(failure);
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it("commits an explicit photo removal and retains existing rich text on update", async () => {
    await journalOperations.update("entry", { photo_url: null });
    expect(mocks.commit).toHaveBeenCalledExactlyOnceWith("reader", {
      ...existing, photo_url: null, updated_at: expect.any(String),
    }, "update");
  });

  it("rejects a failed update commit so the editor can keep the draft", async () => {
    const failure = new Error("Update commit failed");
    mocks.commit.mockRejectedValue(failure);
    await expect(journalOperations.update("entry", { content: "Still a draft" })).rejects.toBe(failure);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("does not write a stale reader's create payload under a newly authenticated reader", async () => {
    mocks.auth.mockResolvedValue({ id: "other-reader" });
    await expect(journalOperations.create({ ...existing })).rejects.toThrow("another reader");
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("does not update another reader's local entry after an account change", async () => {
    mocks.auth.mockResolvedValue({ id: "other-reader" });
    await expect(journalOperations.update("entry", { content: "Changed" })).rejects.toThrow("another reader");
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("does not let an update reassign entry ownership", async () => {
    await expect(journalOperations.update("entry", { user_id: "other-reader" })).rejects.toThrow("another reader");
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("keeps committed saves successful when background sync startup throws", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.sync.mockImplementation(() => { throw new Error("Sync is not ready"); });
    try {
      await expect(journalOperations.create({ book_id: "book", content: "Saved" }))
        .resolves.toMatchObject({ id: "new-entry", content: "Saved" });
      await expect(journalOperations.update("entry", { content: "Saved edit" })).resolves.toBeUndefined();
      expect(mocks.commit).toHaveBeenCalledTimes(2);
      expect(logger).toHaveBeenCalledTimes(2);
      expect(mocks.info).not.toHaveBeenCalled();
    } finally {
      logger.mockRestore();
    }
  });
});
