import { useState, useEffect, useCallback, useRef } from "react";
import {
  BOOK_LISTS_CHANGED_EVENT,
  addBookToList as addBookToListApi,
  createBookList,
  deleteBookList,
  duplicateBookList,
  fetchBookListsPage,
  getApiErrorStatus,
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
  const [owner, setOwner] = useState(userId);
  const [hasLoaded, setHasLoaded] = useState(false);
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const requestId = useRef(0);

  const fetchLists = useCallback(async (isInitial = true, requestedOffset = 0) => {
    if (!userId || activeUser.current !== userId) return;
    const request = ++requestId.current;
    const isCurrent = () => activeUser.current === userId && request === requestId.current;
    
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const currentOffset = isInitial ? 0 : requestedOffset;
      
      const { lists: listsWithCount, hasMore: hasMoreData } =
        await fetchBookListsPage(userId, currentOffset, PAGE_SIZE);
      if (!isCurrent()) return;
      
      setHasMore(hasMoreData);
      setHasLoaded(true);
      
      if (isInitial) {
        setLists(listsWithCount);
        setOffset(PAGE_SIZE);
      } else {
        setLists(prev => [...prev, ...listsWithCount]);
        setOffset(prev => prev + PAGE_SIZE);
      }
    } catch (error) {
      if (isCurrent()) {
        const accessDenied = [401, 403, 404].includes(getApiErrorStatus(error) ?? 0);
        if (accessDenied) {
          setLists([]);
          setHasLoaded(false);
          setHasMore(false);
          setOffset(0);
        }
        setError(accessDenied ? "Your book lists are no longer available in this session. Please sign in again or try again." : "We couldn't load your book lists. Please try again.");
      }
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    setOwner(userId);
    setLists([]);
    setHasLoaded(false);
    setLoading(Boolean(userId));
    setLoadingMore(false);
    setHasMore(false);
    setOffset(0);
    setError(null);
    void fetchLists(true);
    return () => { requestId.current += 1; };
  }, [fetchLists, userId]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const handleListsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (!detail?.userId || detail.userId === userId) {
        void fetchLists(true);
      }
    };

    window.addEventListener(BOOK_LISTS_CHANGED_EVENT, handleListsChanged);
    return () => window.removeEventListener(BOOK_LISTS_CHANGED_EVENT, handleListsChanged);
  }, [fetchLists, userId]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      return fetchLists(false, offset);
    }
  }, [fetchLists, loading, loadingMore, hasMore, offset]);

  const createList = async (name: string, description?: string) => {
    if (!userId) return null;
    
    try {
      const data = await createBookList(userId, name, description);
      await fetchLists(true);
      return data;
    } catch {
      if (activeUser.current === userId) setError("We couldn't update your book lists. Please try again.");
      return null;
    }
  };

  const updateList = async (listId: string, updates: Partial<BookList>) => {
    try {
      await updateBookList(listId, updates);
      await fetchLists(true);
    } catch {
      if (activeUser.current === userId) setError("We couldn't update your book lists. Please try again.");
    }
  };

  const deleteList = async (listId: string) => {
    try {
      await deleteBookList(listId);
      await fetchLists(true);
    } catch {
      if (activeUser.current === userId) setError("We couldn't update your book lists. Please try again.");
    }
  };

  const addBookToList = async (listId: string, bookId: string) => {
    try {
      await addBookToListApi(listId, bookId);
      await fetchLists(true);
    } catch {
      if (activeUser.current === userId) setError("We couldn't update your book lists. Please try again.");
    }
  };

  const removeBookFromList = async (listId: string, bookId: string) => {
    try {
      await removeBookFromListApi(listId, bookId);
      await fetchLists(true);
    } catch {
      if (activeUser.current === userId) setError("We couldn't update your book lists. Please try again.");
    }
  };

  const reorderBooks = async (listId: string, items: { book_id: string; position: number }[]) => {
    try {
      await reorderBookListItems(listId, items);
      await fetchLists(true);
    } catch {
      if (activeUser.current === userId) setError("We couldn't update your book lists. Please try again.");
    }
  };

  const duplicateList = async (listId: string) => {
    if (!userId) return null;
    
    try {
      const newList = await duplicateBookList(userId, listId);
      await fetchLists(true);
      return newList;
    } catch {
      if (activeUser.current === userId) setError("We couldn't update your book lists. Please try again.");
      return null;
    }
  };

  return {
    lists: owner === userId ? lists : [],
    loading: Boolean(userId) && (owner !== userId || (loading && !hasLoaded)),
    refreshing: owner === userId && loading && hasLoaded,
    hasLoaded: owner === userId && hasLoaded,
    loadingMore: owner === userId && loadingMore,
    error: owner === userId ? error : null,
    hasMore: owner === userId && hasMore,
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
