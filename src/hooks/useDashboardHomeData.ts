import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDashboardHome,
  type DashboardBookCandidate,
  type DashboardHomeResponse,
  type DashboardLastActivityType,
} from "@/services/api";

export type {
  DashboardBookCandidate,
  DashboardHomeResponse,
  DashboardLastActivityType,
};

export const useDashboardHomeData = (userId?: string) => {
  const [dashboardHome, setDashboardHome] = useState<DashboardHomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardHomeData = useCallback(async () => {
    if (!userId) {
      setDashboardHome(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await getDashboardHome(10);
      setDashboardHome(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard data";
      setError(message);
      console.error("Error loading dashboard home data:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDashboardHomeData();
  }, [fetchDashboardHomeData]);

  useEffect(() => {
    if (!userId) return;

    const handleReadingSessionSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId && detail.userId !== userId) return;

      void fetchDashboardHomeData();
    };

    window.addEventListener("readingSessionSaved", handleReadingSessionSaved);

    return () => {
      window.removeEventListener("readingSessionSaved", handleReadingSessionSaved);
    };
  }, [fetchDashboardHomeData, userId]);

  const continueBooks = useMemo(() => {
    const candidates = dashboardHome?.continueBooks ?? [];
    const activeBooks = candidates.filter((candidate) => isActiveReadingBook(candidate.book));

    if (activeBooks.length > 0) {
      return activeBooks;
    }

    return candidates.filter((candidate) => candidate.book.status === "to_read");
  }, [dashboardHome?.continueBooks]);

  return {
    dashboardHome,
    continueBooks,
    primaryBook: continueBooks[0] || null,
    secondaryBooks: continueBooks.slice(1, 3),
    loading,
    error,
    refetch: fetchDashboardHomeData,
  };
};

const isActiveReadingBook = (book: DashboardBookCandidate["book"]) => {
  return book.status === "reading" || (book.current_page || 0) > 0;
};
