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
  const mounted = useRef(false);
  const generation = useRef(0);

  const fetchLists = useCallback(async (isInitial = true, requestedOffset = 0) => {
    if (!mounted.current || !userId || activeUser.current !== userId) return;
    const request = ++requestId.current;
    const isCurrent = () => mounted.current && activeUser.current === userId && request === requestId.current;
    
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
    mounted.current = true;
    generation.current += 1;
    setOwner(userId);
    setLists([]);
    setHasLoaded(false);
    setLoading(Boolean(userId));
    setLoadingMore(false);
    setHasMore(false);
    setOffset(0);
    setError(null);
    void fetchLists(true);
    return () => { mounted.current = false; generation.current += 1; requestId.current += 1; };
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

  // A confirmed local/outbox write is complete even if its later read is slow
  // or fails. Consumers own mutation errors; `error` describes collection reads.
  const mutate = async <T,>(write: () => Promise<T>, refreshOnFailure = false): Promise<T> => {
    if (!userId || !mounted.current || activeUser.current !== userId) {
      throw new Error("This list task is no longer active. Sign in and try again.");
    }
    const ownerGeneration = generation.current;
    const isCurrent = () => mounted.current && activeUser.current === userId && generation.current === ownerGeneration;
    try {
      const result = await write();
      if (isCurrent()) void fetchLists(true);
      return result;
    } catch (error) {
      // Duplication can commit its new list before a later item fails. Expose
      // that partial copy through the normal read without claiming success.
      if (refreshOnFailure && isCurrent()) void fetchLists(true);
      throw error;
    }
  };

  const createList = (name: string, description?: string): Promise<BookList> =>
    mutate(() => createBookList(userId!, name, description));
  const updateList = (listId: string, updates: Partial<BookList>): Promise<void> =>
    mutate(() => updateBookList(listId, updates));
  const deleteList = (listId: string): Promise<void> => mutate(() => deleteBookList(listId));
  const addBookToList = (listId: string, bookId: string): Promise<void> =>
    mutate(() => addBookToListApi(listId, bookId));
  const removeBookFromList = (listId: string, bookId: string): Promise<void> =>
    mutate(() => removeBookFromListApi(listId, bookId));
  const reorderBooks = (listId: string, items: { book_id: string; position: number }[]): Promise<void> =>
    mutate(() => reorderBookListItems(listId, items));
  const duplicateList = (listId: string): Promise<BookList> =>
    mutate(() => duplicateBookList(userId!, listId), true);

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
