import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "@/services/api";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  read: vi.fn(),
  local: vi.fn(),
  upsert: vi.fn(),
  online: vi.fn(),
  toast: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  status: vi.fn(),
}));
vi.mock("@/services/api", () => ({
  getCurrentAuthUser: mocks.auth,
  fetchJournalEntries: mocks.read,
}));
vi.mock("@/services/local", () => ({
  journalRepo: { listRecords: mocks.local, upsertRemoteManyPreservingLocal: mocks.upsert },
}));
vi.mock("@/services/connectivity", () => ({
  isConnectivityAvailable: mocks.online,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/utils/offlineOperation", () => ({
  journalOperations: { create: mocks.create, update: mocks.update },
}));
vi.mock("@/utils/bookStatus", () => ({ updateBookStatusIfNeeded: mocks.status }));
import { useJournalEntries, type JournalSaveResult } from "./useJournalEntries";

const draft = {
  book_id: "book",
  entry_type: "reflection" as const,
  title: "A remembered passage",
  content: "My complete draft",
  tags: ["reread"],
  photo_url: "https://example.test/reader/original.jpg",
};
const savedEntry: JournalEntry = {
  ...draft,
  id: "entry",
  user_id: "reader",
  created_at: "2026-09-27T12:00:00Z",
  updated_at: "2026-09-27T12:00:00Z",
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ id: "reader" });
  mocks.online.mockReturnValue(true);
  mocks.local.mockResolvedValue([]);
  mocks.read.mockResolvedValue([]);
  mocks.status.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("journal mutation outcomes", () => {
  it("rejects a failed create without claiming success and permits one deliberate retry", async () => {
    const failure = new Error("Local storage is full");
    mocks.create.mockRejectedValueOnce(failure).mockImplementationOnce(async () => {
      mocks.local.mockResolvedValue([{ data: savedEntry }]);
      return savedEntry;
    });
    const { result } = renderHook(() => useJournalEntries("book", "reader"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    await act(async () => {
      await expect(result.current.addEntry(draft)).rejects.toBe(failure);
    });
    expect(result.current.entries).toEqual([]);
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();

    await act(async () => {
      await expect(result.current.addEntry(draft)).resolves.toEqual({
        entryId: savedEntry.id, savedLocally: true,
      });
    });
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create).toHaveBeenLastCalledWith({ ...draft, user_id: "reader" });
    expect(result.current.entries).toEqual([savedEntry]);
  });

  it("rejects failed updates and retains the last saved entry and attachment", async () => {
    mocks.local.mockResolvedValue([{ data: savedEntry }]);
    mocks.read.mockResolvedValue([savedEntry]);
    const failure = new Error("Local update failed");
    mocks.update.mockRejectedValue(failure);
    const { result } = renderHook(() => useJournalEntries("book", "reader"));
    await waitFor(() => expect(result.current.loading || result.current.refreshing).toBe(false));

    await act(async () => {
      await expect(result.current.updateEntry("entry", { content: "Changed", photo_url: null }))
        .rejects.toBe(failure);
    });
    expect(result.current.entries).toEqual([savedEntry]);
    expect(mocks.local).toHaveBeenCalledTimes(2);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("resolves at local commit without waiting for a read or book-status request", async () => {
    const write = deferred<JournalEntry>();
    const refresh = deferred<[]>();
    const status = deferred<void>();
    mocks.create.mockReturnValue(write.promise);
    mocks.status.mockReturnValue(status.promise);
    const { result } = renderHook(() => useJournalEntries("book", "reader"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    mocks.local.mockReturnValue(refresh.promise);

    let save!: Promise<JournalSaveResult>;
    let settled = false;
    await act(async () => {
      save = result.current.addEntry(draft);
      void save.then(() => { settled = true; });
    });
    expect(settled).toBe(false);
    await act(async () => {
      write.resolve(savedEntry);
      await expect(save).resolves.toEqual({ entryId: "entry", savedLocally: true });
    });
    expect(settled).toBe(true);
    expect(result.current.entries).toEqual([savedEntry]);
    expect(mocks.read).toHaveBeenCalledTimes(1);

    await act(async () => {
      refresh.reject(new Error("Refresh unavailable"));
      status.reject(new Error("Status unavailable"));
    });
    expect(result.current.entries).toEqual([savedEntry]);
    expect(result.current.error).toBe("Journal entries could not be refreshed.");
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("reports committed updates as saved even when the follow-up read fails", async () => {
    mocks.local.mockResolvedValue([{ data: savedEntry }]);
    mocks.read.mockResolvedValue([savedEntry]);
    mocks.update.mockResolvedValue(undefined);
    const { result } = renderHook(() => useJournalEntries("book", "reader"));
    await waitFor(() => expect(result.current.loading || result.current.refreshing).toBe(false));
    mocks.local.mockRejectedValue(new Error("Read failed after commit"));

    await act(async () => {
      await expect(result.current.updateEntry("entry", { content: "Saved change", photo_url: null }))
        .resolves.toEqual({ entryId: "entry", savedLocally: true });
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.entries[0]).toMatchObject({ content: "Saved change", photo_url: null });
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith("entry", { content: "Saved change", photo_url: null });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });

  it("does not let a pre-save remote response erase a committed local entry", async () => {
    const remote = deferred<JournalEntry[]>();
    mocks.read.mockReturnValue(remote.promise);
    mocks.create.mockImplementation(async () => {
      mocks.local.mockResolvedValue([{ data: savedEntry }]);
      return savedEntry;
    });
    const { result } = renderHook(() => useJournalEntries("book", "reader"));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    await act(async () => { await result.current.addEntry(draft); });
    await waitFor(() => expect(result.current.loading || result.current.refreshing).toBe(false));
    await act(async () => { remote.resolve([]); });

    expect(result.current.entries).toEqual([savedEntry]);
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("saves offline using the same local confirmation without a remote request", async () => {
    mocks.online.mockReturnValue(false);
    mocks.create.mockImplementation(async () => {
      mocks.local.mockResolvedValue([{ data: savedEntry }]);
      return savedEntry;
    });
    const { result } = renderHook(() => useJournalEntries("book", "reader"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    await act(async () => {
      await expect(result.current.addEntry(draft)).resolves.toEqual({ entryId: "entry", savedLocally: true });
    });
    expect(mocks.read).not.toHaveBeenCalled();
    expect(result.current.entries).toEqual([savedEntry]);
  });

  it("retains pending and failed local creates when a reopened online journal receives an empty remote list", async () => {
    const failedEntry = { ...savedEntry, id: "failed-create", content: "Still saved here" };
    mocks.local.mockResolvedValue([
      { data: savedEntry, status: "pending" },
      { data: failedEntry, status: "failed" },
      { data: { ...savedEntry, id: "removed-remotely" }, status: "synced" },
    ]);
    const { result } = renderHook(() => useJournalEntries("book", "reader"));
    await waitFor(() => expect(result.current.loading || result.current.refreshing).toBe(false));

    expect(result.current.entries).toEqual([savedEntry, failedEntry]);
    expect(mocks.upsert).toHaveBeenCalledExactlyOnceWith("reader", []);
    expect(mocks.local).toHaveBeenLastCalledWith("reader", { includeDeleted: true });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("hydrates with the preserving repository contract and keeps pending edits and deletions authoritative", async () => {
    const staleEntry = { ...savedEntry, content: "Older remote words" };
    const deletedEntry = { ...savedEntry, id: "deleted-entry", deleted_at: "2026-09-27T13:00:00Z" };
    const remoteOnlyEntry = { ...savedEntry, id: "remote-entry", content: "Another device's entry" };
    mocks.read.mockResolvedValue([staleEntry, { ...deletedEntry, deleted_at: null }, remoteOnlyEntry]);
    mocks.local.mockResolvedValueOnce([{ data: savedEntry, status: "pending" }])
      .mockResolvedValue([
        { data: savedEntry, status: "pending" },
        { data: deletedEntry, status: "deleted", deleted_at: deletedEntry.deleted_at },
        { data: remoteOnlyEntry, status: "synced" },
      ]);
    const { result } = renderHook(() => useJournalEntries("book", "reader"));
    await waitFor(() => expect(result.current.loading || result.current.refreshing).toBe(false));

    expect(mocks.upsert).toHaveBeenCalledExactlyOnceWith("reader", [
      staleEntry, { ...deletedEntry, deleted_at: null }, remoteOnlyEntry,
    ]);
    expect(result.current.entries).toEqual([savedEntry, remoteOnlyEntry]);
    expect(result.current.entries[0].content).not.toBe(staleEntry.content);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("retains the committed local row and reports refresh failure if remote hydration fails", async () => {
    mocks.local.mockResolvedValue([{ data: savedEntry, status: "pending" }]);
    mocks.read.mockResolvedValue([{ ...savedEntry, content: "Stale remote" }]);
    mocks.upsert.mockRejectedValue(new Error("Local read hydration unavailable"));
    const { result } = renderHook(() => useJournalEntries("book", "reader"));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.entries).toEqual([savedEntry]);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("rejects a create for a reader whose authenticated identity changed", async () => {
    const { result } = renderHook(() => useJournalEntries("book", "reader"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    mocks.auth.mockResolvedValue({ id: "other-reader" });
    await expect(result.current.addEntry(draft)).rejects.toThrow("Reader identity changed");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not publish an old save into a newly selected book", async () => {
    const write = deferred<JournalEntry>();
    mocks.create.mockReturnValue(write.promise);
    const { result, rerender } = renderHook(
      ({ bookId }) => useJournalEntries(bookId, "reader"),
      { initialProps: { bookId: "book" } },
    );
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    let save!: Promise<JournalSaveResult>;
    await act(async () => { save = result.current.addEntry(draft); });
    rerender({ bookId: "other-book" });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    await act(async () => { write.resolve(savedEntry); await save; });

    expect(result.current.entries).toEqual([]);
    expect(mocks.status).not.toHaveBeenCalled();
  });
});
