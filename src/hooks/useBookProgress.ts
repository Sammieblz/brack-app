import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BookProgress {
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

export const useBookProgress = (bookId?: string) => {
  const [progress, setProgress] = useState<BookProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProgress = async () => {
    if (!bookId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('calculate-book-progress', {
        body: { book_id: bookId },
      });

      if (error) throw error;
      setProgress(data);
    } catch (error) {
      console.error('Error fetching book progress:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [bookId]);

  return {
    progress,
    loading,
    refetchProgress: fetchProgress,
  };
};
