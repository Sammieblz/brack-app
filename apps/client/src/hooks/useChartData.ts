import { useRetainedReaderResource } from "@/hooks/useRetainedReaderResource";
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
  const resource = useRetainedReaderResource(userId, getAnalyticsChartData);
  return {
    ...resource,
    ...(resource.data ?? emptyChartData()),
  };
};
