import { useState, useEffect, useCallback, useRef } from "react";
import type { Book } from "@/types";
import { fetchListBooks as fetchListBooksApi, getApiErrorStatus } from "@/services/api";

export const useListBooks = (listId?: string, userId?: string) => {
  const identity = `${userId ?? ""}:${listId ?? ""}`;
  const [owner, setOwner] = useState(identity);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(Boolean(listId));
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  const requestId = useRef(0);

  const fetchListBooks = useCallback(async () => {
    if (!listId || activeIdentity.current !== identity) return;
    const request = ++requestId.current;
    const isCurrent = () => activeIdentity.current === identity && request === requestId.current;
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchListBooksApi(listId);
      if (!isCurrent()) return;
      setBooks(result);
      setHasLoaded(true);
    } catch (error) {
      if (isCurrent()) {
        const accessDenied = [401, 403, 404].includes(getApiErrorStatus(error) ?? 0);
        if (accessDenied) {
          setBooks([]);
          setHasLoaded(false);
        }
        setError(accessDenied ? "This book list is no longer available in this session. Please sign in again or try again." : "We couldn't load the books in this list. Please try again.");
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [identity, listId]);

  useEffect(() => {
    setOwner(identity);
    setBooks([]);
    setHasLoaded(false);
    setLoading(Boolean(listId));
    setError(null);
    void fetchListBooks();
    return () => { requestId.current += 1; };
  }, [fetchListBooks, identity, listId]);

  return {
    books: owner === identity ? books : [],
    loading: Boolean(listId) && (owner !== identity || (loading && !hasLoaded)),
    refreshing: owner === identity && loading && hasLoaded,
    hasLoaded: owner === identity && hasLoaded,
    error: owner === identity ? error : null,
    refetch: fetchListBooks
  };
};
