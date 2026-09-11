import { useRetainedReaderResource } from "@/hooks/useRetainedReaderResource";
import { useCallback } from "react";
import {
  fetchProgressTrackingData,
  type CompletionForecast,
  type DailyProgress,
  type VelocityData,
} from "@/services/api";

export const useProgressTracking = (bookId?: string, userId?: string) => {
  const read = useCallback(() => fetchProgressTrackingData(bookId!), [bookId]);
  const resource = useRetainedReaderResource(bookId ? `${userId ?? ""}:${bookId}` : undefined, read);
  return {
    ...resource,
    dailyProgress: resource.data?.dailyProgress ?? [] as DailyProgress[],
    velocityData: resource.data?.velocityData ?? [] as VelocityData[],
    forecastData: resource.data?.forecastData ?? [] as CompletionForecast[],
  };
};
