import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookList } from "@/types";

const api = vi.hoisted(() => ({ read: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), addBook: vi.fn(), removeBook: vi.fn(), reorder: vi.fn(), duplicate: vi.fn() }));
vi.mock("@/services/api", () => ({
  BOOK_LISTS_CHANGED_EVENT: "test-lists-changed", fetchBookListsPage: api.read,
  createBookList: api.create, updateBookList: api.update, deleteBookList: api.remove,
  addBookToList: api.addBook, removeBookFromList: api.removeBook,
  reorderBookListItems: api.reorder, duplicateBookList: api.duplicate,
  getApiErrorStatus: (error: { status?: number }) => error?.status ?? null,
}));
import { useBookLists } from "./useBookLists";

const list = { id: "list-a", user_id: "reader", name: "Weekend", description: null, book_count: 1 } as BookList;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const operations = [
  { name: "create", run: (hook: ReturnType<typeof useBookLists>) => hook.createList("Weekend") },
  { name: "update", run: (hook: ReturnType<typeof useBookLists>) => hook.updateList("list-a", { name: "Changed" }) },
  { name: "remove", run: (hook: ReturnType<typeof useBookLists>) => hook.deleteList("list-a") },
  { name: "addBook", run: (hook: ReturnType<typeof useBookLists>) => hook.addBookToList("list-a", "book-a") },
  { name: "removeBook", run: (hook: ReturnType<typeof useBookLists>) => hook.removeBookFromList("list-a", "book-a") },
  { name: "reorder", run: (hook: ReturnType<typeof useBookLists>) => hook.reorderBooks("list-a", [{ book_id: "book-a", position: 1 }]) },
  { name: "duplicate", run: (hook: ReturnType<typeof useBookLists>) => hook.duplicateList("list-a") },
] as const;
beforeEach(() => {
  vi.resetAllMocks();
  api.read.mockResolvedValue({ lists: [list], hasMore: false });
  api.create.mockResolvedValue(list); api.duplicate.mockResolvedValue({ ...list, id: "copy", name: "Weekend (Copy)" });
});
afterEach(cleanup);

describe("book-list confirmed mutation outcomes", () => {
  it.each(operations)("$name rejects its primary failure without replacing the read outcome", async ({ name, run }) => {
    const failure = new Error("Local write failed"); api[name].mockRejectedValue(failure);
    const { result } = renderHook(() => useBookLists("reader"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    await act(async () => { await expect(run(result.current)).rejects.toBe(failure); });
    expect(result.current.lists).toEqual([list]); expect(result.current.error).toBeNull();
    expect(api.read).toHaveBeenCalledTimes(name === "duplicate" ? 2 : 1);
  });

  it.each([operations[0], operations[1], operations[6]])("$name resolves confirmed work while its refresh remains pending, then retains success if the read fails", async ({ name, run }) => {
    const refresh = deferred<{ lists: BookList[]; hasMore: boolean }>();
    const { result } = renderHook(() => useBookLists("reader"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    api.read.mockReturnValueOnce(refresh.promise);
    let outcome: unknown;
    await act(async () => { outcome = await run(result.current); });
    expect(outcome).toEqual(name === "create" ? list : name === "duplicate" ? { ...list, id: "copy", name: "Weekend (Copy)" } : undefined);
    expect(result.current.refreshing).toBe(true); expect(result.current.lists).toEqual([list]);
    await act(async () => refresh.reject(new Error("Read offline")));
    expect(result.current.refreshing).toBe(false); expect(result.current.error).toContain("couldn't load");
    expect(api[name]).toHaveBeenCalledOnce();
  });

  it("refreshes a partially created duplicate without inventing a successful copy", async () => {
    const { result } = renderHook(() => useBookLists("reader"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const partial = { ...list, id: "partial-copy", name: "Weekend (Copy)", book_count: 0 };
    api.read.mockResolvedValueOnce({ lists: [partial, list], hasMore: false });
    api.duplicate.mockRejectedValueOnce(new Error("Second item failed"));
    await act(async () => { await expect(result.current.duplicateList(list.id)).rejects.toThrow("Second item failed"); });
    expect(result.current.lists).toEqual([partial, list]); expect(api.duplicate).toHaveBeenCalledOnce();
  });

  it.each(["account", "unmount"])("suppresses a confirmed write's refresh after %s abandonment", async change => {
    const write = deferred<BookList>(); api.create.mockReturnValueOnce(write.promise);
    const view = renderHook(({ userId }) => useBookLists(userId), { initialProps: { userId: "reader" } });
    await waitFor(() => expect(view.result.current.hasLoaded).toBe(true));
    let operation!: Promise<BookList>;
    act(() => { operation = view.result.current.createList("Weekend"); });
    if (change === "account") {
      view.rerender({ userId: "other" });
      await waitFor(() => expect(api.read).toHaveBeenLastCalledWith("other", 0, 15));
    } else view.unmount();
    const reads = api.read.mock.calls.length;
    await act(async () => { write.resolve(list); expect(await operation).toBe(list); });
    expect(api.read).toHaveBeenCalledTimes(reads);
  });

  it("rejects a mutation called through an obsolete account closure before invoking the service", async () => {
    const view = renderHook(({ userId }) => useBookLists(userId), { initialProps: { userId: "reader" } });
    await waitFor(() => expect(view.result.current.hasLoaded).toBe(true));
    const obsolete = view.result.current.updateList;
    view.rerender({ userId: "other" });
    await expect(obsolete(list.id, { name: "Wrong reader" })).rejects.toThrow("no longer active");
    expect(api.update).not.toHaveBeenCalled();
  });
});
