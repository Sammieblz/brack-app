import { supabase } from "@/integrations/supabase/client";

export interface ProgressLog {
  id: string;
  user_id: string;
  book_id: string;
  session_id?: string | null;
  page_number: number;
  paragraph_number?: number | null;
  notes?: string | null;
  logged_at: string;
  log_type: "manual" | "timer_based" | "automatic";
  time_spent_minutes?: number | null;
  created_at: string;
}

export interface DailyProgress {
  date: string;
  pages_read: number;
  time_spent: number;
}

export interface VelocityData {
  date: string;
  pages_per_day: number;
  cumulative_pages: number;
}

export interface CompletionForecast {
  date: string;
  predicted_page: number;
  actual_page?: number;
}

export interface ProgressTrackingData {
  dailyProgress: DailyProgress[];
  velocityData: VelocityData[];
  forecastData: CompletionForecast[];
}

export const fetchProgressLogs = async (
  bookId: string
): Promise<ProgressLog[]> => {
  const { data, error } = await supabase
    .from("progress_logs")
    .select("*")
    .eq("book_id", bookId)
    .order("logged_at", { ascending: false });

  if (error) throw error;
  return (data as ProgressLog[]) || [];
};

export const fetchProgressTrackingData = async (
  bookId: string
): Promise<ProgressTrackingData> => {
  const { data: logs, error: logsError } = await supabase
    .from("progress_logs")
    .select("*")
    .eq("book_id", bookId)
    .order("logged_at", { ascending: true });

  if (logsError) throw logsError;

  const { data: sessions, error: sessionsError } = await supabase
    .from("reading_sessions")
    .select("*")
    .eq("book_id", bookId)
    .order("created_at", { ascending: true });

  if (sessionsError) throw sessionsError;

  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("pages, current_page")
    .eq("id", bookId)
    .single();

  if (bookError) throw bookError;

  const dailyMap = new Map<string, { pages: number; time: number }>();

  logs?.forEach((log) => {
    const date = new Date(log.logged_at).toISOString().split("T")[0];
    const existing = dailyMap.get(date) || { pages: 0, time: 0 };
    dailyMap.set(date, {
      pages: Math.max(existing.pages, log.page_number),
      time: existing.time + (log.time_spent_minutes || 0),
    });
  });

  sessions?.forEach((session) => {
    const date = new Date(session.created_at).toISOString().split("T")[0];
    const existing = dailyMap.get(date) || { pages: 0, time: 0 };
    dailyMap.set(date, {
      pages: existing.pages,
      time: existing.time + (session.duration || 0),
    });
  });

  const sortedDates = Array.from(dailyMap.keys()).sort();
  let prevPage = 0;
  const dailyProgress: DailyProgress[] = sortedDates.map((date) => {
    const data = dailyMap.get(date)!;
    const pagesRead = data.pages - prevPage;
    prevPage = data.pages;
    return {
      date,
      pages_read: Math.max(0, pagesRead),
      time_spent: data.time,
    };
  });

  const velocityData: VelocityData[] = [];

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i];
    const data = dailyMap.get(date)!;
    const cumulativePages = data.pages;
    const startIdx = Math.max(0, i - 6);
    const window = sortedDates.slice(startIdx, i + 1);
    const windowPages = window.map((d) => dailyMap.get(d)!.pages);
    const avgPages =
      (windowPages[windowPages.length - 1] - (windowPages[0] || 0)) /
      window.length;

    velocityData.push({
      date,
      pages_per_day: Math.round(avgPages * 10) / 10,
      cumulative_pages: cumulativePages,
    });
  }

  const forecastData: CompletionForecast[] = [];

  if (book && book.pages && velocityData.length > 0) {
    const recentVelocity =
      velocityData
        .slice(-7)
        .reduce((sum, velocity) => sum + velocity.pages_per_day, 0) /
      Math.min(7, velocityData.length);
    const remainingPages = book.pages - (book.current_page || 0);
    const daysToComplete = Math.ceil(remainingPages / Math.max(recentVelocity, 1));
    const today = new Date();

    velocityData.forEach((velocity) => {
      forecastData.push({
        date: velocity.date,
        predicted_page: velocity.cumulative_pages,
        actual_page: velocity.cumulative_pages,
      });
    });

    for (let i = 1; i <= Math.min(daysToComplete, 30); i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      const predictedPage = (book.current_page || 0) + recentVelocity * i;

      forecastData.push({
        date: futureDate.toISOString().split("T")[0],
        predicted_page: Math.min(Math.round(predictedPage), book.pages),
      });
    }
  }

  return { dailyProgress, velocityData, forecastData };
};

export const updateBookStatusForActivity = async (
  bookId: string
): Promise<void> => {
  const { data: book, error: bookError } = await supabase
    .from("books")
    .select("status")
    .eq("id", bookId)
    .single();

  if (bookError || !book || book.status !== "to_read") return;

  const [progressLogs, readingSessions, journalEntries] = await Promise.all([
    supabase.from("progress_logs").select("id").eq("book_id", bookId).limit(1),
    supabase.from("reading_sessions").select("id").eq("book_id", bookId).limit(1),
    supabase.from("journal_entries").select("id").eq("book_id", bookId).limit(1),
  ]);

  const hasActivity =
    (progressLogs.data && progressLogs.data.length > 0) ||
    (readingSessions.data && readingSessions.data.length > 0) ||
    (journalEntries.data && journalEntries.data.length > 0);

  if (!hasActivity) return;

  await supabase
    .from("books")
    .update({
      status: "reading",
      date_started: new Date().toISOString(),
    })
    .eq("id", bookId);
};
