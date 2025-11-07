import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MonthlyStats {
  month: string;
  books_completed: number;
  total_pages: number;
  total_reading_minutes: number;
  avg_daily_minutes: number;
  most_read_genre: string | null;
}

export const useMonthlyStats = (months: number = 12) => {
  const [stats, setStats] = useState<MonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('monthly-stats', {
        body: { months },
      });

      if (error) throw error;
      setStats(data.months || []);
    } catch (error) {
      console.error('Error fetching monthly stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [months]);

  return {
    stats,
    loading,
    refetchStats: fetchStats,
  };
};
