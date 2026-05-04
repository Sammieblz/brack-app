import { supabase } from "@/integrations/supabase/client";
import type { Book } from "@/types";

export interface BookList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  is_public: boolean;
  book_count?: number;
}

export interface BookListItem {
  id: string;
  list_id: string;
  book_id: string;
  position: number;
  added_at: string;
}

export interface BookListsPageResult {
  lists: BookList[];
  hasMore: boolean;
}

export const fetchBookListsPage = async (
  userId: string,
  offset: number,
  pageSize: number
): Promise<BookListsPageResult> => {
  const { data, error } = await supabase
    .from("book_lists")
    .select(
      `
      *,
      book_list_items(count)
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw error;

  const lists =
    data?.map((list) => ({
      ...list,
      book_count: list.book_list_items?.[0]?.count || 0,
    })) || [];

  return {
    lists,
    hasMore: lists.length === pageSize,
  };
};

export const createBookList = async (
  userId: string,
  name: string,
  description?: string
): Promise<BookList> => {
  const { data, error } = await supabase
    .from("book_lists")
    .insert({ user_id: userId, name, description })
    .select()
    .single();

  if (error) throw error;
  return data as BookList;
};

export const updateBookList = async (
  listId: string,
  updates: Partial<BookList>
): Promise<void> => {
  const { error } = await supabase
    .from("book_lists")
    .update(updates)
    .eq("id", listId);

  if (error) throw error;
};

export const deleteBookList = async (listId: string): Promise<void> => {
  const { error } = await supabase.from("book_lists").delete().eq("id", listId);
  if (error) throw error;
};

export const addBookToList = async (
  listId: string,
  bookId: string
): Promise<void> => {
  const { data: items } = await supabase
    .from("book_list_items")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1);

  const maxPosition = items?.[0]?.position || 0;

  const { error } = await supabase.from("book_list_items").insert({
    list_id: listId,
    book_id: bookId,
    position: maxPosition + 1,
  });

  if (error) throw error;
};

export const fetchBookIdsInList = async (
  listId: string
): Promise<string[]> => {
  const { data, error } = await supabase
    .from("book_list_items")
    .select("book_id")
    .eq("list_id", listId);

  if (error) throw error;
  return data?.map((item) => item.book_id) || [];
};

export const fetchListIdsContainingBook = async (
  bookId: string
): Promise<string[]> => {
  const { data, error } = await supabase
    .from("book_list_items")
    .select("list_id")
    .eq("book_id", bookId);

  if (error) throw error;
  return data?.map((item) => item.list_id) || [];
};

export const addBooksToList = async (
  listId: string,
  bookIds: string[]
): Promise<void> => {
  if (bookIds.length === 0) return;

  const { data: items } = await supabase
    .from("book_list_items")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1);

  let position = items?.[0]?.position || 0;
  const insertData = bookIds.map((bookId) => ({
    list_id: listId,
    book_id: bookId,
    position: ++position,
  }));

  const { error } = await supabase.from("book_list_items").insert(insertData);
  if (error) throw error;
};

export const removeBookFromList = async (
  listId: string,
  bookId: string
): Promise<void> => {
  const { error } = await supabase
    .from("book_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("book_id", bookId);

  if (error) throw error;
};

export const reorderBookListItems = async (
  listId: string,
  items: { book_id: string; position: number }[]
): Promise<void> => {
  for (const item of items) {
    const { error } = await supabase
      .from("book_list_items")
      .update({ position: item.position })
      .eq("list_id", listId)
      .eq("book_id", item.book_id);

    if (error) throw error;
  }
};

export const duplicateBookList = async (
  userId: string,
  listId: string
): Promise<BookList> => {
  const { data: originalList, error: listError } = await supabase
    .from("book_lists")
    .select("*")
    .eq("id", listId)
    .single();

  if (listError) throw listError;

  const { data: newList, error: createError } = await supabase
    .from("book_lists")
    .insert({
      user_id: userId,
      name: `${originalList.name} (Copy)`,
      description: originalList.description,
      is_public: originalList.is_public,
    })
    .select()
    .single();

  if (createError) throw createError;

  const { data: books, error: booksError } = await supabase
    .from("book_list_items")
    .select("book_id, position")
    .eq("list_id", listId)
    .order("position", { ascending: true });

  if (booksError) throw booksError;

  if (books && books.length > 0) {
    const bookItems = books.map((book) => ({
      list_id: newList.id,
      book_id: book.book_id,
      position: book.position,
    }));

    const { error: insertError } = await supabase
      .from("book_list_items")
      .insert(bookItems);

    if (insertError) throw insertError;
  }

  return newList as BookList;
};

export const fetchListBooks = async (listId: string): Promise<Book[]> => {
  const { data, error } = await supabase
    .from("book_list_items")
    .select(
      `
      book_id,
      position,
      books (*)
    `
    )
    .eq("list_id", listId)
    .order("position", { ascending: true });

  if (error) throw error;
  return (data?.map((item) => item.books).filter(Boolean) as Book[]) || [];
};
