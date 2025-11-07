import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface DailyProgress {
  date: string;
  pages_read: number;
  time_spent: number;
}

interface VelocityData {
  date: string;
  pages_per_day: number;
  cumulative_pages: number;
}

interface CompletionForecast {
  date: string;
  predicted_page: number;
  actual_page?: number;
}

export const useProgressTracking = (bookId?: string) => {
  const [dailyProgress, setDailyProgress] = useState<DailyProgress[]>([]);
  const [velocityData, setVelocityData] = useState<VelocityData[]>([]);
  const [forecastData, setForecastData] = useState<CompletionForecast[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProgressData = async () => {
    if (!bookId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch progress logs
      const { data: logs, error: logsError } = await supabase
        .from('progress_logs')
        .select('*')
        .eq('book_id', bookId)
        .order('logged_at', { ascending: true });

      if (logsError) throw logsError;

      // Fetch reading sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('reading_sessions')
        .select('*')
        .eq('book_id', bookId)
        .order('created_at', { ascending: true });

      if (sessionsError) throw sessionsError;

      // Fetch book info for forecast
      const { data: book, error: bookError } = await supabase
        .from('books')
        .select('pages, current_page')
        .eq('id', bookId)
        .single();

      if (bookError) throw bookError;

      // Process daily progress
      const dailyMap = new Map<string, { pages: number; time: number }>();
      
      logs?.forEach(log => {
        const date = new Date(log.logged_at).toISOString().split('T')[0];
        const existing = dailyMap.get(date) || { pages: 0, time: 0 };
        dailyMap.set(date, {
          pages: Math.max(existing.pages, log.page_number),
          time: existing.time + (log.time_spent_minutes || 0)
        });
      });

      sessions?.forEach(session => {
        const date = new Date(session.created_at).toISOString().split('T')[0];
        const existing = dailyMap.get(date) || { pages: 0, time: 0 };
        dailyMap.set(date, {
          pages: existing.pages,
          time: existing.time + (session.duration || 0)
        });
      });

      // Calculate daily progress
      const sortedDates = Array.from(dailyMap.keys()).sort();
      let prevPage = 0;
      const daily: DailyProgress[] = sortedDates.map(date => {
        const data = dailyMap.get(date)!;
        const pagesRead = data.pages - prevPage;
        prevPage = data.pages;
        return {
          date,
          pages_read: Math.max(0, pagesRead),
          time_spent: data.time
        };
      });

      setDailyProgress(daily);

      // Calculate velocity (7-day moving average)
      const velocity: VelocityData[] = [];
      let cumulativePages = 0;
      
      for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        const data = dailyMap.get(date)!;
        cumulativePages = data.pages;
        
        // Calculate 7-day moving average
        const startIdx = Math.max(0, i - 6);
        const window = sortedDates.slice(startIdx, i + 1);
        const windowPages = window.map(d => dailyMap.get(d)!.pages);
        const avgPages = (windowPages[windowPages.length - 1] - (windowPages[0] || 0)) / window.length;
        
        velocity.push({
          date,
          pages_per_day: Math.round(avgPages * 10) / 10,
          cumulative_pages: cumulativePages
        });
      }

      setVelocityData(velocity);

      // Generate completion forecast
      if (book && book.pages && velocity.length > 0) {
        const recentVelocity = velocity.slice(-7).reduce((sum, v) => sum + v.pages_per_day, 0) / Math.min(7, velocity.length);
        const remainingPages = book.pages - (book.current_page || 0);
        const daysToComplete = Math.ceil(remainingPages / Math.max(recentVelocity, 1));
        
        const forecast: CompletionForecast[] = [];
        const today = new Date();
        
        // Add historical data points
        velocity.forEach(v => {
          forecast.push({
            date: v.date,
            predicted_page: v.cumulative_pages,
            actual_page: v.cumulative_pages
          });
        });
        
        // Add future predictions
        for (let i = 1; i <= Math.min(daysToComplete, 30); i++) {
          const futureDate = new Date(today);
          futureDate.setDate(today.getDate() + i);
          const predictedPage = (book.current_page || 0) + (recentVelocity * i);
          
          forecast.push({
            date: futureDate.toISOString().split('T')[0],
            predicted_page: Math.min(Math.round(predictedPage), book.pages)
          });
        }
        
        setForecastData(forecast);
      }
    } catch (error) {
      console.error('Error fetching progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgressData();
  }, [bookId]);

  return {
    dailyProgress,
    velocityData,
    forecastData,
    loading,
    refetch: fetchProgressData
  };
};
