import { useState, useEffect, useCallback, useRef } from "react";
import type { Book } from "@/types";
import {
  BOOKS_CHANGED_EVENT,
  fetchUserBooksPage,
  invalidateBooksCache,
  type BooksChangedDetail,
} from "@/services/api";
import { booksRepo } from "@/services/local";
import { readingCoreSync } from "@/services/sync/engine";
import { isConnectivityAvailable } from "@/services/connectivity";

const PAGE_SIZE = 20;

export const useBooks = (userId?: string, enabled = true) => {
  const [books, setBooks] = useState<Book[]>([]);
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

  const fetchBooks = useCallback(async (
    isInitial = true,
    forceRefresh = false,
    requestedOffset = 0
  ) => {
    if (!userId || !enabled || activeUser.current !== userId) return;
    const request = ++requestId.current;
    const isCurrent = () => activeUser.current === userId && request === requestId.current;
    
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      if (isInitial) {
        const localBooks = await booksRepo.list(userId);
        if (!isCurrent()) return;
        if ((localBooks.length > 0 && !forceRefresh) || !isConnectivityAvailable()) {
          setBooks(localBooks);
          setHasLoaded(true);
          setHasMore(false);
          setOffset(localBooks.length);
        }
        if (!isConnectivityAvailable()) return;
      }

      const currentOffset = isInitial ? 0 : requestedOffset;
      
      if (isInitial) {
        await readingCoreSync.syncUser(userId);
        if (!isCurrent()) return;
        const syncedBooks = await booksRepo.list(userId);
        if (!isCurrent()) return;
        setBooks(syncedBooks);
        setHasLoaded(true);
        setHasMore(false);
        setOffset(syncedBooks.length);
      } else {
        const { books: newBooks, hasMore: hasMoreData } =
          await fetchUserBooksPage(userId, currentOffset, PAGE_SIZE);
        if (!isCurrent()) return;
        await booksRepo.upsertRemoteMany(userId, newBooks);
        if (!isCurrent()) return;
        setHasMore(hasMoreData);
        setBooks((prev) => [...prev, ...newBooks]);
        setOffset((prev) => prev + PAGE_SIZE);
      }
    } catch {
      if (isCurrent()) setError("We couldn't refresh your library. Books already on this device are still available.");
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [enabled, userId]);

  useEffect(() => {
    setOwner(userId);
    setBooks([]);
    setHasLoaded(false);
    setError(null);
    setHasMore(false);
    setOffset(0);
    setLoading(Boolean(userId && enabled));
    setLoadingMore(false);
    if (enabled) void fetchBooks(true);
    return () => { requestId.current += 1; };
  }, [enabled, fetchBooks, userId]);

  useEffect(() => {
    if (!userId || !enabled || typeof window === "undefined") return;

    const handleBooksChanged = (event: Event) => {
      const detail = (event as CustomEvent<BooksChangedDetail>).detail;
      if (!detail || (detail.userId && detail.userId !== userId)) return;

      if (detail.type === "upsert") {
        setBooks((prev) => {
          const existingIndex = prev.findIndex((book) => book.id === detail.book.id);
          if (existingIndex === -1) return [detail.book, ...prev];

          const next = [...prev];
          next[existingIndex] = detail.book;
          return next;
        });
        setHasLoaded(true);
        setError(null);
        return;
      }

      if (detail.type === "remove") {
        setBooks((prev) => prev.filter((book) => book.id !== detail.bookId));
        setError(null);
        return;
      }

      if (detail.type === "refresh") {
        void fetchBooks(true, true);
      }
    };

    window.addEventListener(BOOKS_CHANGED_EVENT, handleBooksChanged);
    return () => window.removeEventListener(BOOKS_CHANGED_EVENT, handleBooksChanged);
  }, [enabled, fetchBooks, userId]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      return fetchBooks(false, false, offset);
    }
  }, [fetchBooks, loading, loadingMore, hasMore, offset]);

  const refetchBooks = () => {
    invalidateBooksCache(userId);
    return fetchBooks(true, true);
  };

  const removeBookLocally = (bookId: string) => {
    let removedBook: Book | null = null;
    setBooks((prev) => {
      removedBook = prev.find((book) => book.id === bookId) ?? null;
      return prev.filter((book) => book.id !== bookId);
    });
    return () => {
      if (!removedBook) return;
      setBooks((prev) => {
        if (prev.some((book) => book.id === removedBook?.id)) return prev;
        return [removedBook as Book, ...prev];
      });
    };
  };

  const updateBooksLocally = (updater: (books: Book[]) => Book[]) => {
    let previousBooks: Book[] = [];

    setBooks((prev) => {
      previousBooks = prev;
      return updater(prev);
    });

    return () => setBooks(previousBooks);
  };

  return {
    books: owner === userId ? books : [],
    loading: Boolean(userId && enabled) && (owner !== userId || (loading && !hasLoaded)),
    refreshing: owner === userId && loading && hasLoaded,
    hasLoaded: owner === userId && hasLoaded,
    loadingMore: owner === userId && loadingMore,
    error: owner === userId ? error : null,
    hasMore: owner === userId && hasMore,
    loadMore,
    refetchBooks,
    removeBookLocally,
    updateBooksLocally,
  };
};
