import { useState, useEffect, useCallback } from "react";
import { dataCache } from "@/services/dataCache";
import type { Book } from "@/types";
import {
  BOOKS_CHANGED_EVENT,
  fetchUserBooksPage,
  invalidateBooksCache,
  type BooksChangedDetail,
} from "@/services/api";

const PAGE_SIZE = 20;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export const useBooks = (userId?: string) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchBooks = async (isInitial = true, forceRefresh = false, silent = false) => {
    if (!userId) return;
    
    const cacheKey = `books_${userId}_${isInitial ? 0 : offset}`;
    
    // Check cache first (only for initial load, not pagination)
    if (isInitial && !forceRefresh) {
      const cached = dataCache.get<{ books: Book[]; hasMore: boolean }>(cacheKey);
      if (cached) {
        setBooks(cached.books);
        setHasMore(cached.hasMore);
        setLoading(false);
        setOffset(PAGE_SIZE);
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

      const currentOffset = isInitial ? 0 : offset;
      
      const { books: newBooks, hasMore: hasMoreData } =
        await fetchUserBooksPage(userId, currentOffset, PAGE_SIZE);
      
      // Cache the result (only for initial load)
      if (isInitial) {
        dataCache.set(cacheKey, { books: newBooks, hasMore: hasMoreData }, CACHE_TTL);
      }
      
      setHasMore(hasMoreData);
      
      if (isInitial) {
        setBooks(newBooks);
        setOffset(PAGE_SIZE);
      } else {
        setBooks(prev => [...prev, ...newBooks]);
        setOffset(prev => prev + PAGE_SIZE);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch books');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchBooks(true);
  }, [userId]);

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
  }, [userId]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchBooks(false);
    }
  }, [loadingMore, hasMore, offset]);

  const refetchBooks = () => {
    // Invalidate cache and force refresh
    invalidateBooksCache(userId);
    fetchBooks(true, true);
  };

  const removeBookLocally = (bookId: string) => {
    let removedBook: Book | null = null;
    setBooks((prev) => {
      removedBook = prev.find((book) => book.id === bookId) ?? null;
      return prev.filter((book) => book.id !== bookId);
    });
    if (userId) dataCache.invalidate(`books_${userId}`);
    return () => {
      if (!removedBook) return;
      setBooks((prev) => {
        if (prev.some((book) => book.id === removedBook?.id)) return prev;
        return [removedBook as Book, ...prev];
      });
    };
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
  };
};
