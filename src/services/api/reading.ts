import type { Book, ReadingSession } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "./client";
import type { AwardedBadge } from "./badges";

export interface CreateReadingSessionRequest {
  bookId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  clientSessionId?: string | null;
}

export interface CreateReadingSessionResponse {
  success: boolean;
  idempotent?: boolean;
  session: ReadingSession;
  book?: Book | null;
  streak?: unknown;
  awarded_badges?: AwardedBadge[];
  awarded_count?: number;
}

export interface LogProgressRequest {
  book_id: string;
  page_number: number;
  chapter_number?: number | null;
  paragraph_number?: number | null;
  notes?: string | null;
  log_type?: string;
  time_spent_minutes?: number | null;
  photo_url?: string | null;
}

export interface LogProgressResponse {
  success: boolean;
  log?: unknown;
  progress: {
    current_page: number;
    total_pages: number | null;
    progress_percentage: number;
    pages_per_hour: number;
    total_time_hours: number;
    status: string;
  };
}

export interface BookProgressResponse {
  current_page: number;
  total_pages: number;
  progress_percentage: number;
  pages_per_hour: number;
  estimated_days_to_completion: number | null;
  estimated_completion_date: string | null;
  total_time_hours: number;
  reading_velocity: {
    recent: number;
    overall: number;
  };
  statistics: {
    total_logs: number;
    total_sessions: number;
    avg_session_duration: number;
    longest_session: number;
    last_logged_at: string | null;
  };
}

export const createReadingSession = async (
  request: CreateReadingSessionRequest
): Promise<CreateReadingSessionResponse> => {
  return invokeFunction<CreateReadingSessionResponse>("create-reading-session", {
    body: {
      book_id: request.bookId,
      start_time: request.startTime,
      end_time: request.endTime,
      duration_minutes: request.durationMinutes,
      client_session_id: request.clientSessionId ?? null,
    },
  });
};

export const logProgress = async (
  request: LogProgressRequest
): Promise<LogProgressResponse> => {
  return invokeFunction<LogProgressResponse>("log-progress", {
    body: {
      log_type: "manual",
      ...request,
    },
  });
};

export const getBookProgress = async (bookId: string): Promise<BookProgressResponse> => {
  return invokeFunction<BookProgressResponse>("calculate-book-progress", {
    body: { book_id: bookId },
  });
};

export const fetchBookReadingSessions = async (
  bookId: string
): Promise<ReadingSession[]> => {
  const { data, error } = await supabase
    .from("reading_sessions")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as ReadingSession[];
};

export const fetchUserReadingSessions = async (
  userId: string
): Promise<Pick<ReadingSession, "duration" | "book_id">[]> => {
  const { data, error } = await supabase
    .from("reading_sessions")
    .select("duration, book_id")
    .eq("user_id", userId);

  if (error) throw error;
  return data || [];
};
