import { useState, useEffect, useCallback } from "react";
import {
  addBookToList as addBookToListApi,
  createBookList,
  deleteBookList,
  duplicateBookList,
  fetchBookListsPage,
  removeBookFromList as removeBookFromListApi,
  reorderBookListItems,
  updateBookList,
  type BookList,
  type BookListItem,
} from "@/services/api";

const PAGE_SIZE = 15;

export type { BookList, BookListItem } from "@/services/api";

export const useBookLists = (userId?: string) => {
  const [lists, setLists] = useState<BookList[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchLists = async (isInitial = true) => {
    if (!userId) return;
    
    try {
      if (isInitial) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = isInitial ? 0 : offset;
      
      const { lists: listsWithCount, hasMore: hasMoreData } =
        await fetchBookListsPage(userId, currentOffset, PAGE_SIZE);
      
      setHasMore(hasMoreData);
      
      if (isInitial) {
        setLists(listsWithCount);
        setOffset(PAGE_SIZE);
      } else {
        setLists(prev => [...prev, ...listsWithCount]);
        setOffset(prev => prev + PAGE_SIZE);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchLists(true);
  }, [userId]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchLists(false);
    }
  }, [loadingMore, hasMore, offset]);

  const createList = async (name: string, description?: string) => {
    if (!userId) return null;
    
    try {
      const data = await createBookList(userId, name, description);
      await fetchLists(true);
      return data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  };

  const updateList = async (listId: string, updates: Partial<BookList>) => {
    try {
      await updateBookList(listId, updates);
      await fetchLists(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const deleteList = async (listId: string) => {
    try {
      await deleteBookList(listId);
      await fetchLists(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const addBookToList = async (listId: string, bookId: string) => {
    try {
      await addBookToListApi(listId, bookId);
      await fetchLists(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const removeBookFromList = async (listId: string, bookId: string) => {
    try {
      await removeBookFromListApi(listId, bookId);
      await fetchLists(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const reorderBooks = async (listId: string, items: { book_id: string; position: number }[]) => {
    try {
      await reorderBookListItems(listId, items);
      await fetchLists(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const duplicateList = async (listId: string) => {
    if (!userId) return null;
    
    try {
      const newList = await duplicateBookList(userId, listId);
      await fetchLists(true);
      return newList;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    }
  };

  return {
    lists,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    createList,
    updateList,
    deleteList,
    addBookToList,
    removeBookFromList,
    reorderBooks,
    duplicateList,
    refetch: () => fetchLists(true)
  };
};
