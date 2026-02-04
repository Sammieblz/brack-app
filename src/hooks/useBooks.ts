import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dataCache } from "@/services/dataCache";
import type { Book } from "@/types";

const PAGE_SIZE = 20;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export const useBooks = (userId?: string) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchBooks = async (isInitial = true, forceRefresh = false) => {
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
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = isInitial ? 0 : offset;
      
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1);
      
      if (error) throw error;
      
      const newBooks = data || [];
      const hasMoreData = newBooks.length === PAGE_SIZE;
      
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchBooks(true);
  }, [userId]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchBooks(false);
    }
  }, [loadingMore, hasMore, offset]);

  const refetchBooks = () => {
    // Invalidate cache and force refresh
    if (userId) {
      dataCache.invalidate(`books_${userId}`);
    }
    fetchBooks(true, true);
  };

  return {
    books,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refetchBooks
  };
};