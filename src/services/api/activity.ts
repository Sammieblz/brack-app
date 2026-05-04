import { invokeFunction } from "./client";
import { supabase } from "@/integrations/supabase/client";

export interface EnhancedActivity {
  id: string;
  type: "book_completed" | "book_started" | "progress_logged" | "reading_session";
  description: string;
  timestamp: string;
  book?: {
    id: string;
    title: string;
    author?: string;
    cover_url?: string;
  };
  details?: Record<string, unknown>;
}

export interface EnhancedActivityResponse {
  activities: EnhancedActivity[];
  has_more: boolean;
}

export const getEnhancedActivity = async (
  limit: number,
  offset: number
): Promise<EnhancedActivityResponse> => {
  return invokeFunction<EnhancedActivityResponse>("enhanced-activity", {
    body: { limit, offset },
  });
};

export interface RecentActivity {
  id: string;
  type: "book_completed" | "book_started" | "reading_session" | "goal_set";
  description: string;
  timestamp: string;
  book_title?: string;
}

export const fetchRecentActivity = async (
  userId: string
): Promise<RecentActivity[]> => {
  const activities: RecentActivity[] = [];

  const { data: completedBooks } = await supabase
    .from("books")
    .select("id, title, updated_at, status")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("updated_at", { ascending: false })
    .limit(10);

  completedBooks?.forEach((book) => {
    activities.push({
      id: `book-completed-${book.id}`,
      type: "book_completed",
      description: `Completed reading "${book.title}"`,
      timestamp: book.updated_at,
      book_title: book.title,
    });
  });

  const { data: sessions } = await supabase
    .from("reading_sessions")
    .select(
      `
      id,
      created_at,
      duration,
      books (title)
    `
    )
    .eq("user_id", userId)
    .not("duration", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  sessions?.forEach((session) => {
    const bookTitle =
      (session as { books?: { title?: string } }).books?.title || "Unknown Book";
    const duration = Math.round((session.duration || 0) / 60);
    activities.push({
      id: `session-${session.id}`,
      type: "reading_session",
      description: `Read "${bookTitle}" for ${duration} minutes`,
      timestamp: session.created_at,
      book_title: bookTitle,
    });
  });

  const { data: goals } = await supabase
    .from("goals")
    .select("id, created_at, target_books")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  goals?.forEach((goal) => {
    activities.push({
      id: `goal-${goal.id}`,
      type: "goal_set",
      description: `Set reading goal: ${goal.target_books} books`,
      timestamp: goal.created_at,
    });
  });

  return activities
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 10);
};

export interface ReadingHistoryProgressLog {
  id: string;
  book_id: string;
  page_number: number;
  chapter_number: number | null;
  paragraph_number: number | null;
  notes: string | null;
  logged_at: string;
  log_type: "manual" | "timer_based" | "automatic";
  time_spent_minutes: number | null;
  books: {
    title: string;
    author: string | null;
    cover_url: string | null;
  };
}

export interface ReadingHistoryJournalEntry {
  id: string;
  book_id: string;
  entry_type: "note" | "quote" | "reflection";
  title: string | null;
  content: string;
  page_reference: number | null;
  tags: string[] | null;
  created_at: string;
  books: {
    title: string;
    author: string | null;
    cover_url: string | null;
  };
}

export interface ReadingHistoryData {
  progressLogs: ReadingHistoryProgressLog[];
  journalEntries: ReadingHistoryJournalEntry[];
}

export const fetchReadingHistory = async (
  userId: string
): Promise<ReadingHistoryData> => {
  const { data: logsData, error: logsError } = await supabase
    .from("progress_logs")
    .select(
      `
      id,
      book_id,
      page_number,
      chapter_number,
      paragraph_number,
      notes,
      logged_at,
      log_type,
      time_spent_minutes,
      books (
        title,
        author,
        cover_url
      )
    `
    )
    .eq("user_id", userId)
    .order("logged_at", { ascending: false });

  if (logsError) throw logsError;

  const { data: journalData, error: journalError } = await supabase
    .from("journal_entries")
    .select(
      `
      id,
      book_id,
      entry_type,
      title,
      content,
      page_reference,
      tags,
      created_at,
      books (
        title,
        author,
        cover_url
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (journalError) throw journalError;

  return {
    progressLogs: (logsData || []) as ReadingHistoryProgressLog[],
    journalEntries: (journalData || []) as ReadingHistoryJournalEntry[],
  };
};
