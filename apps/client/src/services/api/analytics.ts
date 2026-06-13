import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "./client";

export interface MonthlyStats {
  month: string;
  books_completed: number;
  total_pages: number;
  total_reading_minutes: number;
  avg_daily_minutes: number;
  most_read_genre: string | null;
}

export interface MonthlyStatsRequest {
  months?: number;
}

export interface MonthlyStatsResponse {
  months: MonthlyStats[];
}

export interface ReadingProgressData {
  date: string;
  books: number;
  minutes: number;
}

export interface GenreData {
  genre: string;
  count: number;
  color: string;
}

export interface WeeklyReadingData {
  day: string;
  minutes: number;
}

export interface ReadingVelocityData {
  date: string;
  pagesPerHour: number;
}

export interface CompletionRateData {
  genre: string;
  completionRate: number;
  total: number;
}

export interface HeatmapData {
  date: string;
  value: number;
}

export interface ScatterData {
  pages: number;
  completionDays: number;
  title: string;
}

export interface MonthlyGoalData {
  month: string;
  goal: number;
  actual: number;
}

export interface StreakTimelineData {
  date: string;
  streak: number;
}

export interface PaceData {
  period: string;
  yourPace: number;
  averagePace: number;
}

export interface AuthorData {
  author: string;
  count: number;
  color: string;
}

export interface TimeDistributionData {
  hour: string;
  minutes: number;
}

export interface FunnelData {
  status: string;
  count: number;
  percentage: number;
}

export interface AnalyticsChartData {
  readingProgress: ReadingProgressData[];
  genreData: GenreData[];
  weeklyReading: WeeklyReadingData[];
  readingVelocity: ReadingVelocityData[];
  completionRate: CompletionRateData[];
  heatmapData: HeatmapData[];
  scatterData: ScatterData[];
  monthlyGoals: MonthlyGoalData[];
  streakTimeline: StreakTimelineData[];
  paceData: PaceData[];
  topAuthors: AuthorData[];
  timeDistribution: TimeDistributionData[];
  statusFunnel: FunnelData[];
}

const emptyChartData = (): AnalyticsChartData => ({
  readingProgress: [],
  genreData: [],
  weeklyReading: [],
  readingVelocity: [],
  completionRate: [],
  heatmapData: [],
  scatterData: [],
  monthlyGoals: [],
  streakTimeline: [],
  paceData: [],
  topAuthors: [],
  timeDistribution: [],
  statusFunnel: [],
});

const genreColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export const getMonthlyStats = async (
  request: MonthlyStatsRequest = {},
): Promise<MonthlyStatsResponse> => {
  return invokeFunction<MonthlyStatsResponse>("monthly-stats", {
    body: request,
  });
};

export const getAnalyticsChartData = async (
  userId: string,
): Promise<AnalyticsChartData> => {
  if (!userId) return emptyChartData();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: sessions } = await supabase
    .from("reading_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at");

  const { data: books } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .not("genre", "is", null);

  const progressMap = new Map<string, { books: number; minutes: number }>();

  sessions?.forEach((session) => {
    const date = new Date(session.created_at).toISOString().split("T")[0];
    const existing = progressMap.get(date) || { books: 0, minutes: 0 };
    progressMap.set(date, {
      books: existing.books,
      minutes: existing.minutes + (session.duration || 0),
    });
  });

  books?.forEach((book) => {
    if (book.status === "completed" && book.updated_at) {
      const date = new Date(book.updated_at).toISOString().split("T")[0];
      const existing = progressMap.get(date) || { books: 0, minutes: 0 };
      progressMap.set(date, {
        books: existing.books + 1,
        minutes: existing.minutes,
      });
    }
  });

  const readingProgress = Array.from(progressMap.entries())
    .map(([date, data]) => ({
      date: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      books: data.books,
      minutes: Math.round(data.minutes),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-14);

  const genreCount = new Map<string, number>();
  books?.forEach((book) => {
    if (book.genre) {
      genreCount.set(book.genre, (genreCount.get(book.genre) || 0) + 1);
    }
  });

  const genreData = Array.from(genreCount.entries())
    .map(([genre, count], index) => ({
      genre,
      count,
      color: genreColors[index % genreColors.length],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: weekSessions } = await supabase
    .from("reading_sessions")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", sevenDaysAgo.toISOString());

  const weeklyMap = new Map<string, number>();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    weeklyMap.set(days[date.getDay()], 0);
  }

  weekSessions?.forEach((session) => {
    const dayName = days[new Date(session.created_at).getDay()];
    weeklyMap.set(dayName, (weeklyMap.get(dayName) || 0) + (session.duration || 0));
  });

  const weeklyReading = Array.from(weeklyMap.entries()).map(([day, minutes]) => ({
    day,
    minutes: Math.round(minutes),
  }));

  const { data: allBooks } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null);

  const { data: activeGoals } = await supabase
    .from("goals")
    .select("target_books,start_date,end_date,period_type,goal_type,is_active,created_at")
    .eq("user_id", userId)
    .eq("goal_type", "books_count")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const velocityMap = new Map<string, { pages: number; hours: number }>();
  sessions?.forEach((session) => {
    if (session.book_id) {
      const book = allBooks?.find((item) => item.id === session.book_id);
      if (book && book.current_page && session.duration) {
        const date = new Date(session.created_at).toISOString().split("T")[0];
        const existing = velocityMap.get(date) || { pages: 0, hours: 0 };
        const hours = session.duration / 60;
        velocityMap.set(date, {
          pages: existing.pages + book.current_page,
          hours: existing.hours + hours,
        });
      }
    }
  });

  const readingVelocity = Array.from(velocityMap.entries())
    .map(([date, data]) => ({
      date: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      pagesPerHour:
        data.hours > 0 ? Math.round((data.pages / data.hours) * 10) / 10 : 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-30);

  const genreCompletion = new Map<string, { completed: number; total: number }>();
  allBooks?.forEach((book) => {
    if (book.genre) {
      const existing = genreCompletion.get(book.genre) || {
        completed: 0,
        total: 0,
      };
      genreCompletion.set(book.genre, {
        completed: existing.completed + (book.status === "completed" ? 1 : 0),
        total: existing.total + 1,
      });
    }
  });

  const completionRate = Array.from(genreCompletion.entries())
    .map(([genre, data]) => ({
      genre,
      completionRate: data.total > 0 ? (data.completed / data.total) * 100 : 0,
      total: data.total,
    }))
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 5);

  const heatmapMap = new Map<string, number>();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  sessions?.forEach((session) => {
    if (new Date(session.created_at) >= oneYearAgo) {
      const date = new Date(session.created_at).toISOString().split("T")[0];
      heatmapMap.set(date, (heatmapMap.get(date) || 0) + (session.duration || 0));
    }
  });

  const heatmapData = Array.from(heatmapMap.entries()).map(([date, value]) => ({
    date,
    value: Math.round(value),
  }));

  const scatterData: ScatterData[] = [];
  allBooks?.forEach((book) => {
    if (book.status === "completed" && book.pages && book.date_started && book.date_finished) {
      const start = new Date(book.date_started);
      const finish = new Date(book.date_finished);
      const completionDays = Math.ceil(
        (finish.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (completionDays > 0 && book.pages > 0) {
        scatterData.push({
          pages: book.pages,
          completionDays,
          title: book.title,
        });
      }
    }
  });

  const monthlyMap = new Map<string, { actual: number }>();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  allBooks?.forEach((book) => {
    if (book.status === "completed" && book.date_finished) {
      const finish = new Date(book.date_finished);
      if (finish >= sixMonthsAgo) {
        const monthKey = finish.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
        const existing = monthlyMap.get(monthKey) || { actual: 0 };
        monthlyMap.set(monthKey, { actual: existing.actual + 1 });
      }
    }
  });

  const activeBookGoal = activeGoals?.[0];
  const monthlyGoalTarget = (date: Date) => {
    if (!activeBookGoal?.target_books) return 2;

    const start = activeBookGoal.start_date ? new Date(activeBookGoal.start_date) : null;
    const end = activeBookGoal.end_date ? new Date(activeBookGoal.end_date) : null;
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    if ((start && monthEnd < start) || (end && monthStart > end)) return 0;
    if (activeBookGoal.period_type === "monthly") return activeBookGoal.target_books;

    const rangeStart = start || new Date(date.getFullYear(), 0, 1);
    const rangeEnd = end || new Date(date.getFullYear(), 11, 31);
    const monthSpan =
      (rangeEnd.getFullYear() - rangeStart.getFullYear()) * 12 +
      (rangeEnd.getMonth() - rangeStart.getMonth()) +
      1;

    return Math.max(1, Math.ceil(activeBookGoal.target_books / Math.max(1, monthSpan)));
  };

  const monthlyGoals: MonthlyGoalData[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    const data = monthlyMap.get(monthKey) || { actual: 0 };
    monthlyGoals.push({
      month: monthKey,
      goal: monthlyGoalTarget(date),
      actual: data.actual,
    });
  }

  const { data: streakHistory } = await supabase
    .from("reading_streak_history")
    .select("*")
    .eq("user_id", userId)
    .order("achieved_at", { ascending: true })
    .limit(100);

  const streakTimeline =
    streakHistory?.map((item) => ({
      date: new Date(item.achieved_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      streak: item.streak_count,
    })) || [];

  const paceData: PaceData[] = [
    {
      period: "This Week",
      yourPace:
        readingVelocity.slice(-7).reduce((sum, item) => sum + item.pagesPerHour, 0) /
          7 || 0,
      averagePace: 30,
    },
    {
      period: "This Month",
      yourPace:
        readingVelocity.reduce((sum, item) => sum + item.pagesPerHour, 0) /
          readingVelocity.length || 0,
      averagePace: 30,
    },
  ];

  const authorCount = new Map<string, number>();
  allBooks?.forEach((book) => {
    if (book.author) {
      authorCount.set(book.author, (authorCount.get(book.author) || 0) + 1);
    }
  });

  const topAuthors = Array.from(authorCount.entries())
    .map(([author, count], index) => ({
      author,
      count,
      color: genreColors[index % genreColors.length],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const hourMap = new Map<number, number>();
  sessions?.forEach((session) => {
    const hour = new Date(session.created_at).getHours();
    hourMap.set(hour, (hourMap.get(hour) || 0) + (session.duration || 0));
  });

  const timeDistribution = Array.from({ length: 24 }, (_, i) => ({
    hour: i.toString().padStart(2, "0"),
    minutes: Math.round(hourMap.get(i) || 0),
  }));

  const statusCount = new Map<string, number>();
  allBooks?.forEach((book) => {
    statusCount.set(book.status, (statusCount.get(book.status) || 0) + 1);
  });

  const total = allBooks?.length || 1;
  const statusFunnel = Array.from(statusCount.entries()).map(([status, count]) => ({
    status,
    count,
    percentage: (count / total) * 100,
  }));

  return {
    readingProgress,
    genreData,
    weeklyReading,
    readingVelocity,
    completionRate,
    heatmapData,
    scatterData: scatterData.slice(0, 50),
    monthlyGoals,
    streakTimeline,
    paceData,
    topAuthors,
    timeDistribution,
    statusFunnel,
  };
};
