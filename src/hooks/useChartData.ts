import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export const useChartData = (userId?: string) => {
  const [readingProgress, setReadingProgress] = useState<ReadingProgressData[]>([]);
  const [genreData, setGenreData] = useState<GenreData[]>([]);
  const [weeklyReading, setWeeklyReading] = useState<WeeklyReadingData[]>([]);
  const [readingVelocity, setReadingVelocity] = useState<ReadingVelocityData[]>([]);
  const [completionRate, setCompletionRate] = useState<CompletionRateData[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [scatterData, setScatterData] = useState<ScatterData[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoalData[]>([]);
  const [streakTimeline, setStreakTimeline] = useState<StreakTimelineData[]>([]);
  const [paceData, setPaceData] = useState<PaceData[]>([]);
  const [topAuthors, setTopAuthors] = useState<AuthorData[]>([]);
  const [timeDistribution, setTimeDistribution] = useState<TimeDistributionData[]>([]);
  const [statusFunnel, setStatusFunnel] = useState<FunnelData[]>([]);
  const [loading, setLoading] = useState(true);

  const genreColors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  useEffect(() => {
    if (userId) {
      fetchChartData();
    }
  }, [userId]);

  const fetchChartData = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Fetch reading progress over time (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: sessions } = await supabase
        .from('reading_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at');

      const { data: books } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId)
        .not('genre', 'is', null);

      // Process reading progress data
      const progressMap = new Map<string, { books: number; minutes: number }>();
      
      sessions?.forEach(session => {
        const date = new Date(session.created_at).toISOString().split('T')[0];
        const existing = progressMap.get(date) || { books: 0, minutes: 0 };
        progressMap.set(date, {
          books: existing.books,
          minutes: existing.minutes + (session.duration || 0)
        });
      });

      books?.forEach(book => {
        if (book.status === 'completed' && book.updated_at) {
          const date = new Date(book.updated_at).toISOString().split('T')[0];
          const existing = progressMap.get(date) || { books: 0, minutes: 0 };
          progressMap.set(date, {
            books: existing.books + 1,
            minutes: existing.minutes
          });
        }
      });

      const progressData = Array.from(progressMap.entries())
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          books: data.books,
          minutes: Math.round(data.minutes)
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-14); // Last 14 days

      setReadingProgress(progressData);

      // Process genre data
      const genreCount = new Map<string, number>();
      books?.forEach(book => {
        if (book.genre) {
          genreCount.set(book.genre, (genreCount.get(book.genre) || 0) + 1);
        }
      });

      const genreArray = Array.from(genreCount.entries())
        .map(([genre, count], index) => ({
          genre,
          count,
          color: genreColors[index % genreColors.length]
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setGenreData(genreArray);

      // Process weekly reading data (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: weekSessions } = await supabase
        .from('reading_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', sevenDaysAgo.toISOString());

      const weeklyMap = new Map<string, number>();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      // Initialize all days with 0
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        const dayName = days[date.getDay()];
        weeklyMap.set(dayName, 0);
      }

      weekSessions?.forEach(session => {
        const dayName = days[new Date(session.created_at).getDay()];
        weeklyMap.set(dayName, (weeklyMap.get(dayName) || 0) + (session.duration || 0));
      });

      const weeklyArray = Array.from(weeklyMap.entries()).map(([day, minutes]) => ({
        day,
        minutes: Math.round(minutes)
      }));

      setWeeklyReading(weeklyArray);

      // Fetch all books for additional analytics
      const { data: allBooks } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null);

      // Calculate reading velocity (pages/hour over time)
      const velocityMap = new Map<string, { pages: number; hours: number }>();
      sessions?.forEach(session => {
        if (session.book_id) {
          const book = allBooks?.find(b => b.id === session.book_id);
          if (book && book.current_page && session.duration) {
            const date = new Date(session.created_at).toISOString().split('T')[0];
            const existing = velocityMap.get(date) || { pages: 0, hours: 0 };
            const hours = session.duration / 60;
            velocityMap.set(date, {
              pages: existing.pages + book.current_page,
              hours: existing.hours + hours
            });
          }
        }
      });

      const velocityArray = Array.from(velocityMap.entries())
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          pagesPerHour: data.hours > 0 ? Math.round((data.pages / data.hours) * 10) / 10 : 0
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-30); // Last 30 days
      setReadingVelocity(velocityArray);

      // Calculate completion rate by genre
      const genreCompletion = new Map<string, { completed: number; total: number }>();
      allBooks?.forEach(book => {
        if (book.genre) {
          const existing = genreCompletion.get(book.genre) || { completed: 0, total: 0 };
          genreCompletion.set(book.genre, {
            completed: existing.completed + (book.status === 'completed' ? 1 : 0),
            total: existing.total + 1
          });
        }
      });

      const completionArray = Array.from(genreCompletion.entries())
        .map(([genre, data]) => ({
          genre,
          completionRate: data.total > 0 ? (data.completed / data.total) * 100 : 0,
          total: data.total
        }))
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 5);
      setCompletionRate(completionArray);

      // Generate heatmap data (last 12 months)
      const heatmapMap = new Map<string, number>();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      sessions?.forEach(session => {
        if (new Date(session.created_at) >= oneYearAgo) {
          const date = new Date(session.created_at).toISOString().split('T')[0];
          heatmapMap.set(date, (heatmapMap.get(date) || 0) + (session.duration || 0));
        }
      });

      const heatmapArray = Array.from(heatmapMap.entries()).map(([date, value]) => ({
        date,
        value: Math.round(value)
      }));
      setHeatmapData(heatmapArray);

      // Book length vs completion time scatter
      const scatterArray: ScatterData[] = [];
      allBooks?.forEach(book => {
        if (book.status === 'completed' && book.pages && book.date_started && book.date_finished) {
          const start = new Date(book.date_started);
          const finish = new Date(book.date_finished);
          const days = Math.ceil((finish.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (days > 0 && book.pages > 0) {
            scatterArray.push({
              pages: book.pages,
              completionDays: days,
              title: book.title
            });
          }
        }
      });
      setScatterData(scatterArray.slice(0, 50)); // Limit to 50 books

      // Monthly goals vs actual (last 6 months)
      const monthlyMap = new Map<string, { actual: number }>();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      allBooks?.forEach(book => {
        if (book.status === 'completed' && book.date_finished) {
          const finish = new Date(book.date_finished);
          if (finish >= sixMonthsAgo) {
            const monthKey = finish.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            const existing = monthlyMap.get(monthKey) || { actual: 0 };
            monthlyMap.set(monthKey, { actual: existing.actual + 1 });
          }
        }
      });

      // Generate months array with goals (assuming 2 books/month goal)
      const monthlyArray: MonthlyGoalData[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const data = monthlyMap.get(monthKey) || { actual: 0 };
        monthlyArray.push({
          month: monthKey,
          goal: 2, // Default goal
          actual: data.actual
        });
      }
      setMonthlyGoals(monthlyArray);

      // Streak timeline (from streak history)
      const { data: streakHistory } = await supabase
        .from('reading_streak_history')
        .select('*')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: true })
        .limit(100);

      const streakArray = streakHistory?.map(item => ({
        date: new Date(item.achieved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        streak: item.streak_count
      })) || [];
      setStreakTimeline(streakArray);

      // Reading pace comparison (simplified - using average of 30 pages/hour)
      const paceArray: PaceData[] = [
        { period: 'This Week', yourPace: velocityArray.slice(-7).reduce((sum, v) => sum + v.pagesPerHour, 0) / 7 || 0, averagePace: 30 },
        { period: 'This Month', yourPace: velocityArray.reduce((sum, v) => sum + v.pagesPerHour, 0) / velocityArray.length || 0, averagePace: 30 },
      ];
      setPaceData(paceArray);

      // Top authors
      const authorCount = new Map<string, number>();
      allBooks?.forEach(book => {
        if (book.author) {
          authorCount.set(book.author, (authorCount.get(book.author) || 0) + 1);
        }
      });

      const authorArray = Array.from(authorCount.entries())
        .map(([author, count], index) => ({
          author,
          count,
          color: genreColors[index % genreColors.length]
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopAuthors(authorArray);

      // Time distribution (hour of day)
      const hourMap = new Map<number, number>();
      sessions?.forEach(session => {
        const hour = new Date(session.created_at).getHours();
        hourMap.set(hour, (hourMap.get(hour) || 0) + (session.duration || 0));
      });

      const timeArray = Array.from({ length: 24 }, (_, i) => ({
        hour: i.toString().padStart(2, '0'),
        minutes: Math.round(hourMap.get(i) || 0)
      }));
      setTimeDistribution(timeArray);

      // Status funnel
      const statusCount = new Map<string, number>();
      allBooks?.forEach(book => {
        statusCount.set(book.status, (statusCount.get(book.status) || 0) + 1);
      });

      const total = allBooks?.length || 1;
      const funnelArray = Array.from(statusCount.entries()).map(([status, count]) => ({
        status,
        count,
        percentage: (count / total) * 100
      }));
      setStatusFunnel(funnelArray);

    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    readingProgress,
    genreData,
    weeklyReading,
    readingVelocity,
    completionRate,
    heatmapData,
    scatterData,
    monthlyGoals,
    streakTimeline,
    paceData,
    topAuthors,
    timeDistribution,
    statusFunnel,
    loading,
    refetch: fetchChartData
  };
};