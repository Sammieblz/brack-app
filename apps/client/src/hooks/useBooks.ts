import { useState, useEffect, useCallback } from "react";
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

export const useBooks = (userId?: string) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchBooks = useCallback(async (
    isInitial = true,
    forceRefresh = false,
    silent = false,
    requestedOffset = 0
  ) => {
    if (!userId) return;

    if (isInitial) {
      const localBooks = await booksRepo.list(userId);
      if (localBooks.length > 0 && !forceRefresh) {
        setBooks(localBooks);
        setHasMore(false);
        setLoading(false);
        setOffset(localBooks.length);
      }

      if (!isConnectivityAvailable()) {
        setBooks(localBooks);
        setHasMore(false);
        setLoading(false);
        return;
      }
    }
    
    try {
      if (isInitial) {
        if (!silent) setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = isInitial ? 0 : requestedOffset;
      
      if (isInitial) {
        await readingCoreSync.syncUser(userId);
        const syncedBooks = await booksRepo.list(userId);
        setBooks(syncedBooks);
        setHasMore(false);
        setOffset(syncedBooks.length);
      } else {
        const { books: newBooks, hasMore: hasMoreData } =
          await fetchUserBooksPage(userId, currentOffset, PAGE_SIZE);
        await booksRepo.upsertRemoteMany(userId, newBooks);
        setHasMore(hasMoreData);
        setBooks((prev) => [...prev, ...newBooks]);
        setOffset((prev) => prev + PAGE_SIZE);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch books');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBooks(true);
  }, [fetchBooks]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

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
        setError(null);
        return;
      }

      if (detail.type === "remove") {
        setBooks((prev) => prev.filter((book) => book.id !== detail.bookId));
        setError(null);
        return;
      }

      if (detail.type === "refresh") {
        void fetchBooks(true, true, true);
      }
    };

    window.addEventListener(BOOKS_CHANGED_EVENT, handleBooksChanged);
    return () => window.removeEventListener(BOOKS_CHANGED_EVENT, handleBooksChanged);
  }, [fetchBooks, userId]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchBooks(false, false, false, offset);
    }
  }, [fetchBooks, loadingMore, hasMore, offset]);

  const refetchBooks = () => {
    invalidateBooksCache(userId);
    if (isConnectivityAvailable() && userId) {
      readingCoreSync.syncUser(userId).catch(console.error);
    }
    fetchBooks(true, true);
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
    books,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refetchBooks,
    removeBookLocally,
    updateBooksLocally,
  };
};
