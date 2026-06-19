import { supabase } from "@/integrations/supabase/client";
import {
  bookListItemsRepo,
  bookListsRepo,
  booksRepo,
  createLocalId,
  syncRepo,
} from "@/services/local";
import { readingCoreSync } from "@/services/sync/engine";
import { isConnectivityAvailable } from "@/services/connectivity";
import type { Book, BookList, BookListItem } from "@/types";
import { getCurrentAuthUser } from "./auth";

export type { BookList, BookListItem } from "@/types";

export const BOOK_LISTS_CHANGED_EVENT = "brack:book-lists-changed";

export interface BookListsPageResult {
  lists: BookList[];
  hasMore: boolean;
}

const emitListsChanged = (userId: string) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(BOOK_LISTS_CHANGED_EVENT, { detail: { userId } })
    );
  }
};

const syncInBackground = (userId: string) => {
  if (!isConnectivityAvailable()) return;
  void readingCoreSync.syncUser(userId).catch(console.error);
};

const normalizeRemoteList = (list: Record<string, unknown>): BookList => ({
  id: String(list.id),
  user_id: String(list.user_id),
  name: String(list.name),
  description: (list.description as string | null) ?? null,
  created_at: String(list.created_at),
  updated_at: String(list.updated_at),
  deleted_at: (list.deleted_at as string | null) ?? null,
  is_public: Boolean(list.is_public),
  order_version: Number(list.order_version ?? 0),
  book_count: Number(
    (list.book_list_items as Array<{ count?: number }> | undefined)?.[0]?.count ?? 0
  ),
});

const normalizeRemoteItem = (
  item: Record<string, unknown>,
  fallbackUserId: string
): BookListItem => ({
  id: String(item.id),
  user_id: String(item.user_id ?? fallbackUserId),
  list_id: String(item.list_id),
  book_id: String(item.book_id),
  position: Number(item.position ?? 0),
  added_at: String(item.added_at),
  updated_at: String(item.updated_at ?? item.added_at),
  deleted_at: (item.deleted_at as string | null) ?? null,
});

const requireUser = async () => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");
  return user;
};

const listLocalItems = async (userId: string, listId?: string) => {
  const items = await bookListItemsRepo.list(userId);
  return items
    .filter((item) => !listId || item.list_id === listId)
    .sort((a, b) => a.position - b.position);
};

export const fetchBookListsPage = async (
  userId: string,
  offset: number,
  pageSize: number
): Promise<BookListsPageResult> => {
  const localLists = await bookListsRepo.list(userId);
  const localItems = await listLocalItems(userId);
  const withLocalCounts = localLists.map((list) => ({
    ...list,
    book_count: localItems.filter((item) => item.list_id === list.id).length,
  }));

  if (!isConnectivityAvailable()) {
    return {
      lists: withLocalCounts.slice(offset, offset + pageSize),
      hasMore: offset + pageSize < withLocalCounts.length,
    };
  }

  const { data, error } = await supabase
    .from("book_lists")
    .select("*, book_list_items(count)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    if (withLocalCounts.length > 0) {
      return {
        lists: withLocalCounts.slice(offset, offset + pageSize),
        hasMore: offset + pageSize < withLocalCounts.length,
      };
    }
    throw error;
  }

  const lists = (data ?? []).map((list) =>
    normalizeRemoteList(list as unknown as Record<string, unknown>)
  );
  await bookListsRepo.upsertRemoteMany(userId, lists);
  return { lists, hasMore: lists.length === pageSize };
};

export const createBookList = async (
  userId: string,
  name: string,
  description?: string
): Promise<BookList> => {
  const timestamp = new Date().toISOString();
  const list: BookList = {
    id: createLocalId(),
    user_id: userId,
    name: name.trim(),
    description: description?.trim() || null,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    is_public: false,
    order_version: 0,
    book_count: 0,
  };
  await bookListsRepo.upsertLocal(userId, list, "create");
  emitListsChanged(userId);
  syncInBackground(userId);
  return list;
};

export const updateBookList = async (
  listId: string,
  updates: Partial<BookList>
): Promise<void> => {
  const user = await requireUser();
  const existing = await bookListsRepo.get(listId);
  if (!existing) throw new Error("List is not available locally yet");
  await bookListsRepo.upsertLocal(
    user.id,
    { ...existing, ...updates, updated_at: new Date().toISOString() },
    "update"
  );
  emitListsChanged(user.id);
  syncInBackground(user.id);
};

export const deleteBookList = async (listId: string): Promise<void> => {
  const user = await requireUser();
  const existing = await bookListsRepo.get(listId);
  if (!existing) throw new Error("List is not available locally yet");
  await bookListsRepo.softDeleteLocal(user.id, existing);
  emitListsChanged(user.id);
  syncInBackground(user.id);
};

export const addBookToList = async (listId: string, bookId: string): Promise<void> => {
  const user = await requireUser();
  const items = await listLocalItems(user.id, listId);
  if (items.some((item) => item.book_id === bookId)) return;
  const timestamp = new Date().toISOString();
  const item: BookListItem = {
    id: createLocalId(),
    user_id: user.id,
    list_id: listId,
    book_id: bookId,
    position: (items.at(-1)?.position ?? 0) + 1,
    added_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
  await bookListItemsRepo.upsertLocal(user.id, item, "create");
  emitListsChanged(user.id);
  syncInBackground(user.id);
};

export const fetchBookIdsInList = async (listId: string): Promise<string[]> => {
  const user = await requireUser();
  return (await listLocalItems(user.id, listId)).map((item) => item.book_id);
};

export const fetchListIdsContainingBook = async (bookId: string): Promise<string[]> => {
  const user = await requireUser();
  return (await listLocalItems(user.id))
    .filter((item) => item.book_id === bookId)
    .map((item) => item.list_id);
};

export const addBooksToList = async (listId: string, bookIds: string[]): Promise<void> => {
  for (const bookId of bookIds) {
    await addBookToList(listId, bookId);
  }
};

export const removeBookFromList = async (listId: string, bookId: string): Promise<void> => {
  const user = await requireUser();
  const item = (await listLocalItems(user.id, listId)).find(
    (candidate) => candidate.book_id === bookId
  );
  if (!item) return;
  await bookListItemsRepo.softDeleteLocal(user.id, item);
  emitListsChanged(user.id);
  syncInBackground(user.id);
};

export const reorderBookListItems = async (
  listId: string,
  items: { book_id: string; position: number }[]
): Promise<void> => {
  const user = await requireUser();
  const list = await bookListsRepo.get(listId);
  if (!list) throw new Error("List is not available locally yet");
  const existingItems = await listLocalItems(user.id, listId);
  const timestamp = new Date().toISOString();
  const positions = new Map(items.map((item) => [item.book_id, item.position]));

  await Promise.all(
    existingItems.map((item) =>
      bookListItemsRepo.upsertRemote(user.id, {
        ...item,
        position: positions.get(item.book_id) ?? item.position,
        updated_at: timestamp,
      })
    )
  );

  const nextVersion = list.order_version + 1;
  await bookListsRepo.upsertRemote(user.id, {
    ...list,
    order_version: nextVersion,
    updated_at: timestamp,
  });
  await syncRepo.enqueueMutation(user.id, "book_lists", listId, "reorder", {
    list_id: listId,
    ordered_book_ids: items
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((item) => item.book_id),
    expected_version: list.order_version,
    order_version: nextVersion,
    updated_at: timestamp,
  });

  emitListsChanged(user.id);
  syncInBackground(user.id);
};

export const duplicateBookList = async (
  userId: string,
  listId: string
): Promise<BookList> => {
  const original = await bookListsRepo.get(listId);
  if (!original) throw new Error("List is not available locally yet");
  const duplicate = await createBookList(
    userId,
    `${original.name} (Copy)`,
    original.description ?? undefined
  );
  const items = await listLocalItems(userId, listId);
  await addBooksToList(
    duplicate.id,
    items.map((item) => item.book_id)
  );
  return duplicate;
};

export const fetchListBooks = async (listId: string): Promise<Book[]> => {
  const user = await requireUser();
  let items = await listLocalItems(user.id, listId);

  if (items.length === 0 && isConnectivityAvailable()) {
    const { data, error } = await supabase
      .from("book_list_items")
      .select("*")
      .eq("list_id", listId)
      .is("deleted_at", null)
      .order("position", { ascending: true });
    if (!error && data) {
      items = data.map((item) =>
        normalizeRemoteItem(item as unknown as Record<string, unknown>, user.id)
      );
      await bookListItemsRepo.upsertRemoteMany(user.id, items);
    }
  }

  const books = await Promise.all(items.map((item) => booksRepo.get(item.book_id)));
  return books.filter((book): book is Book => Boolean(book && !book.deleted_at));
};
