import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { StreakData, DayActivity } from "@/utils/streakCalculation";
import {
  applyReadingStreakFreeze,
  fetchStreakSummary,
} from "@/services/api";

export const useStreaks = (userId?: string) => {
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastReadingDate: null,
    canUseFreezeToday: false,
    freezeAvailable: true,
    hasReadingToday: false,
    usedFreezeToday: false,
  });
  const [activityCalendar, setActivityCalendar] = useState<DayActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStreakData = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchStreakSummary(userId);
      setStreakData(data.streakData);
      setActivityCalendar(data.activityCalendar);
    } catch (error: unknown) {
      console.error("Error fetching streak data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      setStreakData({
        currentStreak: 0,
        longestStreak: 0,
        lastReadingDate: null,
        canUseFreezeToday: false,
        freezeAvailable: true,
        hasReadingToday: false,
        usedFreezeToday: false,
      });
      setActivityCalendar([]);
      setLoading(false);
      return;
    }

    void fetchStreakData();

    const handleReadingSessionSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;

      if (!detail?.userId || detail.userId === userId) {
        void fetchStreakData();
      }
    };

    window.addEventListener("readingSessionSaved", handleReadingSessionSaved);

    return () => {
      window.removeEventListener("readingSessionSaved", handleReadingSessionSaved);
    };
  }, [userId]);

  const useStreakFreeze = async () => {
    if (!userId || !streakData.freezeAvailable || !streakData.canUseFreezeToday) {
      return false;
    }

    try {
      const today = new Date().toISOString().split("T")[0];

      await applyReadingStreakFreeze(userId, today);

      toast({
        title: "Streak Freeze Used!",
        description: "Your streak has been preserved for today. You can use this again in 7 days.",
      });

      await fetchStreakData();
      return true;
    } catch (error: unknown) {
      console.error("Error using streak freeze:", error);
      toast({
        title: "Error",
        description: "Failed to use streak freeze",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    streakData,
    activityCalendar,
    loading,
    refetchStreaks: fetchStreakData,
    useStreakFreeze,
  };
};
