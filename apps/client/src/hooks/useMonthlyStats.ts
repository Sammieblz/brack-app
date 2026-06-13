import { useState, useEffect } from "react";
import { getMonthlyStats, type MonthlyStats } from "@/services/api";

export const useMonthlyStats = (months: number = 12) => {
  const [stats, setStats] = useState<MonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await getMonthlyStats({ months });
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
