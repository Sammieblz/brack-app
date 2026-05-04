import { useState, useEffect } from "react";
import {
  fetchProgressTrackingData,
  type CompletionForecast,
  type DailyProgress,
  type VelocityData,
} from "@/services/api";

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
      const data = await fetchProgressTrackingData(bookId);
      setDailyProgress(data.dailyProgress);
      setVelocityData(data.velocityData);
      setForecastData(data.forecastData);
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
