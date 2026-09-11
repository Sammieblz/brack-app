import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "@/types";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), online: vi.fn(), getUser: vi.fn(), listRecords: vi.fn(), listItems: vi.fn(),
  getBook: vi.fn(), upsertLists: vi.fn(), upsertItems: vi.fn(), upsertBooks: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/services/connectivity", () => ({ isConnectivityAvailable: mocks.online }));
vi.mock("./auth", () => ({ getCurrentAuthUser: mocks.getUser }));
vi.mock("@/services/sync/engine", () => ({ readingCoreSync: { syncUser: vi.fn() } }));
vi.mock("@/services/local", () => ({
  bookListsRepo: { listRecords: mocks.listRecords, upsertRemoteManyPreservingLocal: mocks.upsertLists },
  bookListItemsRepo: { list: mocks.listItems, upsertRemoteManyPreservingLocal: mocks.upsertItems },
  booksRepo: { get: mocks.getBook, upsertRemoteMany: mocks.upsertBooks }, createLocalId: vi.fn(),
}));

import { fetchBookListsPage, fetchListBooks } from "./bookLists";

const list = { id: "list-a", user_id: "reader", name: "Saved list", deleted_at: null };
const item = { id: "item-a", user_id: "reader", list_id: "list-a", book_id: "book-a", position: 0 };
const book = { id: "book-a", user_id: "reader", title: "Saved book", deleted_at: null } as Book;
type Response = { data: unknown; error: unknown; status: number };
let responses: Response[];

beforeEach(() => {
  vi.resetAllMocks();
  responses = [];
  mocks.online.mockReturnValue(true);
  mocks.getUser.mockResolvedValue({ id: "reader" });
  mocks.listRecords.mockResolvedValue([{ id: list.id, status: "synced", data: list }]);
  mocks.listItems.mockResolvedValue([item]);
  mocks.getBook.mockResolvedValue(book);
  mocks.from.mockImplementation(() => {
    const response = responses.shift();
    const builder: Record<string, unknown> = {
      then: (resolve: (value: Response | undefined) => unknown) => Promise.resolve(response).then(resolve),
    };
    for (const method of ["select", "eq", "is", "order", "range", "in"]) builder[method] = vi.fn(() => builder);
    return builder;
  });
});

describe("book list read fallback safety", () => {
  it.each([401, 403, 404])("does not replace a confirmed HTTP %i with local list data", async (status) => {
    responses.push({ data: null, error: { message: "access denied" }, status });
    await expect(fetchBookListsPage("reader", 0, 15)).rejects.toMatchObject({ status });
    expect(mocks.upsertLists).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404])("does not expose cached list books after a confirmed HTTP %i", async (status) => {
    responses.push({ data: null, error: { message: "access denied" }, status });
    await expect(fetchListBooks("list-a")).rejects.toMatchObject({ status });
    expect(mocks.getBook).not.toHaveBeenCalled();
  });

  it("preserves the existing local fallback for a transient list failure", async () => {
    responses.push({ data: null, error: { message: "unavailable" }, status: 503 });
    await expect(fetchBookListsPage("reader", 0, 15)).resolves.toEqual({ lists: [{ ...list, book_count: 1 }], hasMore: false });
  });

  it("preserves local books during a transient detail failure", async () => {
    responses.push({ data: null, error: { message: "unavailable" }, status: 503 });
    await expect(fetchListBooks("list-a")).resolves.toEqual([book]);
  });

  it("does not claim an empty list after an uncached transient detail failure", async () => {
    mocks.listItems.mockResolvedValue([]);
    const error = { message: "unavailable" };
    responses.push({ data: null, error, status: 503 });
    await expect(fetchListBooks("list-a")).rejects.toEqual(error);
  });

  it("propagates a forbidden missing-book lookup", async () => {
    mocks.getBook.mockResolvedValue(null);
    responses.push({ data: [item], error: null, status: 200 }, { data: null, error: { message: "denied" }, status: 403 });
    await expect(fetchListBooks("list-a")).rejects.toMatchObject({ status: 403 });
  });

  it("marks an unauthenticated list read explicitly", async () => {
    mocks.getUser.mockResolvedValue(null);
    await expect(fetchListBooks("list-a")).rejects.toMatchObject({ status: 401 });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("keeps offline owned lists available without a remote request", async () => {
    mocks.online.mockReturnValue(false);
    await expect(fetchBookListsPage("reader", 0, 15)).resolves.toMatchObject({ lists: [{ ...list, book_count: 1 }] });
    await expect(fetchListBooks("list-a")).resolves.toEqual([book]);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
