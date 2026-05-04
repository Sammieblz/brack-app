import { useState, useEffect } from "react";
import type { Book } from "@/types";
import { fetchListBooks as fetchListBooksApi } from "@/services/api";

export const useListBooks = (listId?: string) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListBooks = async () => {
    if (!listId) return;
    
    try {
      setLoading(true);
      setBooks(await fetchListBooksApi(listId));
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
