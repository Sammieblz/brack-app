import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Book } from "@/types";

const PAGE_SIZE = 20;

export const useBooks = (userId?: string) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const fetchBooks = async (isInitial = true) => {
    if (!userId) return;
    
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
      setHasMore(newBooks.length === PAGE_SIZE);
      
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
    fetchBooks(true);
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