import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Book } from "@/types";

export const useListBooks = (listId?: string) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListBooks = async () => {
    if (!listId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('book_list_items')
        .select(`
          book_id,
          position,
          books (*)
        `)
        .eq('list_id', listId)
        .order('position', { ascending: true });
      
      if (error) throw error;
      
      const booksData = data?.map(item => item.books).filter(Boolean) as Book[];
      setBooks(booksData || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load list books");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListBooks();
  }, [listId]);

  return {
    books,
    loading,
    error,
    refetch: fetchListBooks
  };
};
