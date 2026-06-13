import { useCallback, useEffect, useState } from "react";
import {
  getAnalyticsChartData,
  type AnalyticsChartData,
  type AuthorData,
  type CompletionRateData,
  type FunnelData,
  type GenreData,
  type HeatmapData,
  type MonthlyGoalData,
  type PaceData,
  type ReadingProgressData,
  type ReadingVelocityData,
  type ScatterData,
  type StreakTimelineData,
  type TimeDistributionData,
  type WeeklyReadingData,
} from "@/services/api";

export type {
  AuthorData,
  CompletionRateData,
  FunnelData,
  GenreData,
  HeatmapData,
  MonthlyGoalData,
  PaceData,
  ReadingProgressData,
  ReadingVelocityData,
  ScatterData,
  StreakTimelineData,
  TimeDistributionData,
  WeeklyReadingData,
};

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

export const useChartData = (userId?: string) => {
  const [chartData, setChartData] = useState<AnalyticsChartData>(emptyChartData);
  const [loading, setLoading] = useState(true);

  const fetchChartData = useCallback(async () => {
    if (!userId) {
      setChartData(emptyChartData());
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getAnalyticsChartData(userId);
      setChartData(data);
    } catch (error) {
      console.error("Error fetching chart data:", error);
      setChartData(emptyChartData());
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchChartData();
  }, [fetchChartData]);

  return {
    ...chartData,
    loading,
    refetch: fetchChartData,
  };
};
