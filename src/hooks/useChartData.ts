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

export const useChartData = (userId?: string) => {
  const [readingProgress, setReadingProgress] = useState<ReadingProgressData[]>([]);
  const [genreData, setGenreData] = useState<GenreData[]>([]);
  const [weeklyReading, setWeeklyReading] = useState<WeeklyReadingData[]>([]);
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
    loading,
    refetch: fetchChartData
  };
};