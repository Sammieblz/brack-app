import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";

const mocks = vi.hoisted(() => ({
  listLocal: vi.fn(), sync: vi.fn(), online: vi.fn(), fetchBooks: vi.fn(),
  fetchLists: vi.fn(), fetchListBooks: vi.fn(), invalidate: vi.fn(),
}));
vi.mock("@/services/api", () => ({
  BOOKS_CHANGED_EVENT: "books-changed-test", BOOK_LISTS_CHANGED_EVENT: "lists-changed-test",
  fetchUserBooksPage: mocks.fetchBooks, invalidateBooksCache: mocks.invalidate,
  fetchBookListsPage: mocks.fetchLists, fetchListBooks: mocks.fetchListBooks,
  getApiErrorStatus: (error: { status?: number }) => error?.status ?? null,
  addBookToList: vi.fn(), createBookList: vi.fn(), deleteBookList: vi.fn(), duplicateBookList: vi.fn(),
  removeBookFromList: vi.fn(), reorderBookListItems: vi.fn(), updateBookList: vi.fn(),
}));
vi.mock("@/services/local", () => ({ booksRepo: { list: mocks.listLocal, upsertRemoteMany: vi.fn() } }));
vi.mock("@/services/sync/engine", () => ({ readingCoreSync: { syncUser: mocks.sync } }));
vi.mock("@/services/connectivity", () => ({ isConnectivityAvailable: mocks.online }));

import { useBooks } from "./useBooks";
import { useBookLists } from "./useBookLists";
import { useListBooks } from "./useListBooks";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const book = { id: "book-a", user_id: "user-a", title: "Cached book", status: "to_read" } as Book;
const list = { id: "list-a", name: "Cached list", book_count: 1 };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.online.mockReturnValue(true);
  mocks.listLocal.mockResolvedValue([]);
  mocks.sync.mockResolvedValue(undefined);
  mocks.fetchLists.mockResolvedValue({ lists: [], hasMore: false });
  mocks.fetchListBooks.mockResolvedValue([]);
});

describe("Library retained loading", () => {
  it("reveals local books before a delayed sync and waits for refresh completion", async () => {
    const pending = deferred<void>();
    mocks.listLocal.mockResolvedValue([book]);
    mocks.sync.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useBooks("user-a"));
    await waitFor(() => expect(result.current.books).toEqual([book]));
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    await act(async () => pending.resolve());
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    const refresh = deferred<void>();
    mocks.sync.mockReturnValueOnce(refresh.promise);
    let complete = false;
    let operation!: Promise<void>;
    act(() => { operation = result.current.refetchBooks().then(() => { complete = true; }); });
    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.books).toEqual([book]);
    expect(complete).toBe(false);
    await act(async () => { refresh.resolve(); await operation; });
    expect(complete).toBe(true);
  });

  it("retains a loaded empty library during refresh and reports failures separately", async () => {
    const { result } = renderHook(() => useBooks("user-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const refresh = deferred<void>();
    mocks.sync.mockReturnValueOnce(refresh.promise);
    act(() => { void result.current.refetchBooks(); });
    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.books).toEqual([]);
    await act(async () => refresh.reject(new Error("private backend detail")));
    expect(result.current.error).toContain("couldn't refresh");
    expect(result.current.error).not.toContain("private backend detail");
    expect(result.current.hasLoaded).toBe(true);
  });

  it("does not carry books or delayed errors across user identities", async () => {
    const previous = deferred<void>();
    const next = deferred<void>();
    mocks.listLocal.mockImplementation((user: string) => Promise.resolve(user === "user-a" ? [book] : []));
    mocks.sync.mockImplementation((user: string) => user === "user-a" ? previous.promise : next.promise);
    const { result, rerender } = renderHook(({ user }) => useBooks(user), { initialProps: { user: "user-a" } });
    await waitFor(() => expect(result.current.books).toEqual([book]));
    rerender({ user: "user-b" });
    expect(result.current.books).toEqual([]);
    expect(result.current.loading).toBe(true);
    await act(async () => previous.reject(new Error("old request")));
    expect(result.current.error).toBeNull();
    await act(async () => next.resolve());
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.books).toEqual([]);
  });

  it("settles local storage failures instead of remaining busy", async () => {
    mocks.listLocal.mockRejectedValue(new Error("storage unavailable"));
    const { result } = renderHook(() => useBooks("user-a"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.loading).toBe(false);
    expect(result.current.hasLoaded).toBe(false);
  });
});

describe("Book list retained loading", () => {
  it("retains populated lists during refresh and appends load-more results", async () => {
    mocks.fetchLists.mockResolvedValueOnce({ lists: [list], hasMore: true });
    const { result } = renderHook(() => useBookLists("user-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const page = deferred<{ lists: typeof list[]; hasMore: boolean }>();
    mocks.fetchLists.mockReturnValueOnce(page.promise);
    act(() => { void result.current.loadMore(); });
    expect(result.current.loadingMore).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.lists).toEqual([list]);
    const second = { ...list, id: "list-b" };
    await act(async () => page.resolve({ lists: [second], hasMore: false }));
    expect(result.current.lists).toEqual([list, second]);
    expect(mocks.fetchLists).toHaveBeenLastCalledWith("user-a", 15, 15);
    const refresh = deferred<{ lists: typeof list[]; hasMore: boolean }>();
    mocks.fetchLists.mockReturnValueOnce(refresh.promise);
    act(() => { void result.current.refetch(); });
    expect(result.current.refreshing).toBe(true);
    expect(result.current.lists).toEqual([list, second]);
    await act(async () => refresh.resolve({ lists: [list], hasMore: false }));
    expect(result.current.lists).toEqual([list]);
  });

  it("preserves an empty successful result and clears an error on retry", async () => {
    const { result } = renderHook(() => useBookLists("user-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const refresh = deferred<never>();
    mocks.fetchLists.mockReturnValueOnce(refresh.promise);
    act(() => { void result.current.refetch(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    await act(async () => refresh.reject(new Error("failed")));
    expect(result.current.error).not.toBeNull();
    expect(result.current.hasLoaded).toBe(true);
    await act(async () => { await result.current.refetch(); });
    expect(result.current.error).toBeNull();
  });

  it("ignores a previous user's delayed list response", async () => {
    const previous = deferred<{ lists: typeof list[]; hasMore: boolean }>();
    mocks.fetchLists.mockReturnValueOnce(previous.promise);
    const { result, rerender } = renderHook(({ user }) => useBookLists(user), { initialProps: { user: "user-a" } });
    rerender({ user: "user-b" });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    await act(async () => previous.resolve({ lists: [list], hasMore: false }));
    expect(result.current.lists).toEqual([]);
  });

  it.each([401, 403, 404])("does not retain remote-confirmed inaccessible lists after %i", async (status) => {
    mocks.fetchLists.mockResolvedValueOnce({ lists: [list], hasMore: false });
    const { result } = renderHook(() => useBookLists("user-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    mocks.fetchLists.mockRejectedValueOnce(Object.assign(new Error("denied"), { status }));
    await act(async () => { await result.current.refetch(); });
    expect(result.current.lists).toEqual([]);
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.error).toContain("no longer available");
  });
});

describe("List detail retained loading", () => {
  it("does not replace a loaded empty list on refresh", async () => {
    const { result } = renderHook(() => useListBooks("list-a", "user-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const refresh = deferred<Book[]>();
    mocks.fetchListBooks.mockReturnValueOnce(refresh.promise);
    act(() => { void result.current.refetch(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    await act(async () => refresh.resolve([book]));
    expect(result.current.books).toEqual([book]);
  });

  it("rejects a delayed result after the list identity changes", async () => {
    const previous = deferred<Book[]>();
    mocks.fetchListBooks.mockReturnValueOnce(previous.promise);
    const { result, rerender } = renderHook(({ id }) => useListBooks(id, "user-a"), { initialProps: { id: "list-a" } });
    rerender({ id: "list-b" });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    await act(async () => previous.resolve([book]));
    expect(result.current.books).toEqual([]);
  });

  it("distinguishes a failed cold load from an empty successful list", async () => {
    mocks.fetchListBooks.mockRejectedValueOnce(new Error("failed"));
    const { result } = renderHook(() => useListBooks("list-a", "user-a"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.loading).toBe(false);
    expect(result.current.hasLoaded).toBe(false);
    await act(async () => { await result.current.refetch(); });
    expect(result.current.error).toBeNull();
    expect(result.current.hasLoaded).toBe(true);
  });

  it("removes retained list content on a confirmed permission failure", async () => {
    mocks.fetchListBooks.mockResolvedValueOnce([book]);
    const { result } = renderHook(() => useListBooks("list-a", "user-a"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    mocks.fetchListBooks.mockRejectedValueOnce(Object.assign(new Error("denied"), { status: 403 }));
    await act(async () => { await result.current.refetch(); });
    expect(result.current.books).toEqual([]);
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.error).toContain("no longer available");
  });
});
