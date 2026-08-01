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
  pagesPerHour: number;
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

interface ReadingSessionTimelineInput {
  duration?: number | null;
  start_time?: string | null;
  created_at?: string | null;
}

const toActivityDate = (value: string | null | undefined) => {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().split("T")[0] : null;
};

export const buildProgressTimeline = (
  logs: Array<Pick<ProgressLog, "logged_at" | "page_number" | "time_spent_minutes">>,
  sessions: ReadingSessionTimelineInput[],
): Pick<ProgressTrackingData, "dailyProgress" | "velocityData"> => {
  const dailyMap = new Map<string, { page: number | null; time: number }>();

  logs.forEach((log) => {
    const date = toActivityDate(log.logged_at);
    if (!date) return;
    const existing = dailyMap.get(date) || { page: null, time: 0 };
    dailyMap.set(date, {
      page: Math.max(existing.page ?? 0, log.page_number),
      time: existing.time + (log.time_spent_minutes || 0),
    });
  });

  sessions.forEach((session) => {
    const date = toActivityDate(session.start_time || session.created_at);
    if (!date) return;
    const existing = dailyMap.get(date) || { page: null, time: 0 };
    dailyMap.set(date, {
      page: existing.page,
      time: existing.time + (session.duration || 0),
    });
  });

  const sortedDates = Array.from(dailyMap.keys()).sort();
  const cumulativePagesByDate = new Map<string, number>();
  let previousPage = 0;
  const dailyProgress: DailyProgress[] = sortedDates.map((date) => {
    const data = dailyMap.get(date)!;
    const effectivePage =
      data.page === null ? previousPage : Math.max(previousPage, data.page);
    const pagesRead = effectivePage - previousPage;
    previousPage = effectivePage;
    cumulativePagesByDate.set(date, previousPage);
    return {
      date,
      pages_read: pagesRead,
      time_spent: data.time,
    };
  });

  const velocityData = sortedDates.map((date, index): VelocityData => {
    const daily = dailyProgress[index];
    const cumulativePages = cumulativePagesByDate.get(date) ?? 0;
    const currentDate = new Date(`${date}T00:00:00.000Z`);
    const windowStart = new Date(currentDate);
    windowStart.setUTCDate(windowStart.getUTCDate() - 6);
    const firstDate = new Date(`${sortedDates[0]}T00:00:00.000Z`);
    const effectiveStart =
      firstDate.getTime() > windowStart.getTime() ? firstDate : windowStart;
    const windowDays = Math.max(
      1,
      Math.round((currentDate.getTime() - effectiveStart.getTime()) / 86_400_000) + 1,
    );
    const baselineDate = sortedDates
      .slice(0, index)
      .reverse()
      .find((candidate) => new Date(`${candidate}T00:00:00.000Z`) < windowStart);
    const baselinePages = baselineDate
      ? cumulativePagesByDate.get(baselineDate) ?? 0
      : 0;
    const averagePages = Math.max(
      0,
      (cumulativePages - baselinePages) / windowDays,
    );

    return {
      date,
      pages_per_day: Math.round(averagePages * 10) / 10,
      pagesPerHour:
        daily.time_spent > 0
          ? Math.round((daily.pages_read * 60 * 10) / daily.time_spent) / 10
          : 0,
      cumulative_pages: cumulativePages,
    };
  });

  return { dailyProgress, velocityData };
};

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

  const { dailyProgress, velocityData } = buildProgressTimeline(
    (logs ?? []) as ProgressLog[],
    sessions ?? [],
  );

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
    supabase
      .from("journal_entries")
      .select("id")
      .eq("book_id", bookId)
      .is("deleted_at", null)
      .limit(1),
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
