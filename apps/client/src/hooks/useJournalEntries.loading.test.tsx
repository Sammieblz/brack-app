import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  local: vi.fn(),
  upsert: vi.fn(),
  online: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/services/api", () => ({
  getCurrentAuthUser: async () => ({ id: "reader" }),
  fetchJournalEntries: mocks.read,
}));
vi.mock("@/services/local", () => ({
  journalRepo: { listRecords: mocks.local, upsertRemote: mocks.upsert },
}));
vi.mock("@/services/connectivity", () => ({
  isConnectivityAvailable: mocks.online,
}));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock("@/utils/offlineOperation", () => ({ journalOperations: {} }));
vi.mock("@/utils/bookStatus", () => ({ updateBookStatusIfNeeded: vi.fn() }));
import { useJournalEntries } from "./useJournalEntries";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.online.mockReturnValue(true);
  mocks.local.mockResolvedValue([]);
});
afterEach(cleanup);

describe("journal local-first loading", () => {
  it("shows local writing before a slow remote request and retains it on transient failure", async () => {
    const remote = deferred<unknown[]>();
    const entry = {
      id: "entry",
      book_id: "book",
      user_id: "reader",
      content: "Saved locally",
    };
    mocks.local.mockResolvedValue([{ data: entry }]);
    mocks.read.mockReturnValue(remote.promise);
    const { result } = renderHook(() => useJournalEntries("book", "reader"));
    await waitFor(() => expect(result.current.entries).toEqual([entry]));
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    const logger = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    await act(async () => remote.reject({ status: 503 }));
    expect(result.current.entries).toEqual([entry]);
    expect(result.current.error).not.toBeNull();
    logger.mockRestore();
  });

  it("treats offline empty storage as loaded and masks entries on book changes", async () => {
    mocks.online.mockReturnValue(false);
    const { result, rerender } = renderHook(
      ({ bookId }) => useJournalEntries(bookId, "reader"),
      { initialProps: { bookId: "book" } },
    );
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.entries).toEqual([]);
    expect(result.current.loading).toBe(false);
    mocks.local.mockReturnValue(new Promise(() => undefined));
    rerender({ bookId: "other-book" });
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.loading).toBe(true);
    expect(result.current.entries).toEqual([]);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
