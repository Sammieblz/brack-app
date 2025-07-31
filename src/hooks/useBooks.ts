import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Book } from "@/types";

export const useBooks = (userId?: string) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setBooks(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [userId]);

  const refetchBooks = () => {
    fetchBooks();
  };

  return {
    books,
    loading,
    error,
    refetchBooks
  };
};