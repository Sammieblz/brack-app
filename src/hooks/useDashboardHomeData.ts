import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getProgressPercentage } from "@/utils/bookProgress";
import type { Book } from "@/types";

export type DashboardLastActivityType =
  | "progress_log"
  | "reading_session"
  | "book_update"
  | "date_started"
  | "created";

export interface DashboardBookCandidate {
  book: Book;
  lastActivityAt: string;
  lastActivityType: DashboardLastActivityType;
  progressPercent: number;
  ctaLabel: string;
}

interface BookActivity {
  at: string;
  type: DashboardLastActivityType;
}

type ProgressLogActivity = {
  book_id: string;
  logged_at: string;
};

type ReadingSessionActivity = {
  book_id: string | null;
  created_at: string | null;
  start_time: string | null;
};

export const useDashboardHomeData = (userId?: string) => {
  const [candidates, setCandidates] = useState<DashboardBookCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardHomeData = useCallback(async () => {
    if (!userId) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [booksResult, progressResult, sessionsResult] = await Promise.all([
        supabase
          .from("books")
          .select("*")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .in("status", ["reading", "to_read"])
          .order("updated_at", { ascending: false })
          .limit(50),
        supabase
          .from("progress_logs")
          .select("book_id, logged_at")
          .eq("user_id", userId)
          .order("logged_at", { ascending: false })
          .limit(100),
        supabase
          .from("reading_sessions")
          .select("book_id, created_at, start_time")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (booksResult.error) throw booksResult.error;
      if (progressResult.error) throw progressResult.error;
      if (sessionsResult.error) throw sessionsResult.error;

      const latestProgressByBook = getLatestActivityByBook(
        (progressResult.data || []) as ProgressLogActivity[],
        "progress_log",
        (log) => log.book_id,
        (log) => log.logged_at
      );

      const latestSessionByBook = getLatestActivityByBook(
        (sessionsResult.data || []) as ReadingSessionActivity[],
        "reading_session",
        (session) => session.book_id,
        (session) => session.start_time || session.created_at
      );

      const rankedCandidates = ((booksResult.data || []) as Book[])
        .map((book) => {
          const fallbackActivity = getBookFallbackActivity(book);
          const latestActivity = getLatestActivity([
            latestProgressByBook.get(book.id),
            latestSessionByBook.get(book.id),
            fallbackActivity,
          ]);

          return {
            book,
            lastActivityAt: latestActivity.at,
            lastActivityType: latestActivity.type,
            progressPercent: Math.round(getProgressPercentage(book)),
            ctaLabel: getCandidateCta(book),
          };
        })
        .sort((a, b) => {
          const priorityDiff = getBookPriority(b.book) - getBookPriority(a.book);
          if (priorityDiff !== 0) return priorityDiff;

          return (
            new Date(b.lastActivityAt).getTime() -
            new Date(a.lastActivityAt).getTime()
          );
        });

      setCandidates(rankedCandidates);
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

  const continueBooks = useMemo(() => {
    const activeBooks = candidates.filter((candidate) => isActiveReadingBook(candidate.book));

    if (activeBooks.length > 0) {
      return activeBooks;
    }

    return candidates.filter((candidate) => candidate.book.status === "to_read");
  }, [candidates]);

  return {
    continueBooks,
    primaryBook: continueBooks[0] || null,
    secondaryBooks: continueBooks.slice(1, 3),
    loading,
    error,
    refetch: fetchDashboardHomeData,
  };
};

const getLatestActivityByBook = <T,>(
  items: T[],
  type: DashboardLastActivityType,
  getBookId: (item: T) => string | null,
  getTimestamp: (item: T) => string | null
) => {
  const latestByBook = new Map<string, BookActivity>();

  items.forEach((item) => {
    const bookId = getBookId(item);
    const timestamp = getTimestamp(item);
    if (!bookId || !timestamp) return;

    const current = latestByBook.get(bookId);
    if (!current || new Date(timestamp).getTime() > new Date(current.at).getTime()) {
      latestByBook.set(bookId, { at: timestamp, type });
    }
  });

  return latestByBook;
};

const getLatestActivity = (activities: Array<BookActivity | undefined>): BookActivity => {
  const validActivities = activities.filter(Boolean) as BookActivity[];

  return validActivities.reduce((latest, activity) => {
    return new Date(activity.at).getTime() > new Date(latest.at).getTime()
      ? activity
      : latest;
  });
};

const getBookFallbackActivity = (book: Book): BookActivity => {
  const fallbackActivities: BookActivity[] = [
    { at: book.updated_at, type: "book_update" },
    ...(book.date_started ? [{ at: book.date_started, type: "date_started" } as BookActivity] : []),
    { at: book.created_at, type: "created" },
  ].filter((activity) => Boolean(activity.at));

  return getLatestActivity(fallbackActivities);
};

const isActiveReadingBook = (book: Book) => {
  return book.status === "reading" || (book.current_page || 0) > 0;
};

const getBookPriority = (book: Book) => {
  if (isActiveReadingBook(book)) return 2;
  if (book.status === "to_read") return 1;
  return 0;
};

const getCandidateCta = (book: Book) => {
  return isActiveReadingBook(book) ? "Continue" : "Start reading";
};
