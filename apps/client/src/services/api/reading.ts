import type { Book, ReadingSession } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "./client";
import type { AwardedBadge } from "./badges";
import { booksRepo, sessionsRepo } from "@/services/local";

export interface CreateReadingSessionRequest {
  bookId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  clientSessionId?: string | null;
}

export interface CompleteReadingRequest {
  bookId: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  clientSessionId?: string | null;
  pageNumber?: number | null;
  chapterNumber?: number | null;
  paragraphNumber?: number | null;
  notes?: string | null;
  logType?: string | null;
  timeSpentMinutes?: number | null;
  photoUrl?: string | null;
  clientLogId?: string | null;
  markComplete?: boolean;
}

export interface CompleteReadingResponse {
  success: boolean;
  idempotent?: boolean;
  session_idempotent?: boolean;
  progress_idempotent?: boolean;
  session: ReadingSession | null;
  progress_log?: unknown;
  log_id?: string | null;
  book?: Book | null;
  streak?: unknown;
  goal_progress?: unknown;
  activity?: unknown;
  awarded_badges?: AwardedBadge[];
  awarded_count?: number;
  progress?: {
    current_page: number;
    total_pages: number | null;
    progress_percentage: number;
    pages_per_hour: number;
    total_time_hours: number;
    status: string;
  };
}

export type CreateReadingSessionResponse = CompleteReadingResponse;

export interface LogProgressRequest {
  id?: string;
  book_id: string;
  page_number: number;
  chapter_number?: number | null;
  paragraph_number?: number | null;
  notes?: string | null;
  log_type?: string;
  time_spent_minutes?: number | null;
  photo_url?: string | null;
  client_log_id?: string | null;
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
  const response = await invokeFunction<CreateReadingSessionResponse>("create-reading-session", {
    body: {
      book_id: request.bookId,
      start_time: request.startTime,
      end_time: request.endTime,
      duration_minutes: request.durationMinutes,
      client_session_id: request.clientSessionId ?? null,
    },
  });

  if (response.session?.user_id) {
    await sessionsRepo.upsertRemote(response.session.user_id, response.session);
    if (response.book) {
      await booksRepo.upsertRemote(response.session.user_id, response.book);
    }
  }

  return response;
};

export const completeReading = async (
  request: CompleteReadingRequest
): Promise<CompleteReadingResponse> => {
  const response = await invokeFunction<CompleteReadingResponse>("complete-reading", {
    body: {
      book_id: request.bookId,
      start_time: request.startTime ?? null,
      end_time: request.endTime ?? null,
      duration_minutes: request.durationMinutes ?? null,
      client_session_id: request.clientSessionId ?? null,
      page_number: request.pageNumber ?? null,
      chapter_number: request.chapterNumber ?? null,
      paragraph_number: request.paragraphNumber ?? null,
      notes: request.notes ?? null,
      log_type: request.logType ?? "manual",
      time_spent_minutes: request.timeSpentMinutes ?? null,
      photo_url: request.photoUrl ?? null,
      client_log_id: request.clientLogId ?? null,
      mark_complete: request.markComplete ?? false,
    },
  });

  const userId = response.session?.user_id || response.book?.user_id;
  if (userId) {
    if (response.session) {
      await sessionsRepo.upsertRemote(userId, response.session);
    }
    if (response.book) {
      await booksRepo.upsertRemote(userId, response.book);
    }
  }

  return response;
};

export const logProgress = async (
  request: LogProgressRequest
): Promise<LogProgressResponse> => {
  return invokeFunction<LogProgressResponse>("log-progress", {
    body: {
      log_type: "manual",
      ...request,
      client_log_id: request.client_log_id ?? request.id ?? null,
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
