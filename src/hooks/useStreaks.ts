import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { calculateStreakFromDays, getActivityCalendarFromDays } from "@/utils/streakCalculation";
import type { ReadingStreakDay } from "@/types";
import type { StreakData, DayActivity } from "@/utils/streakCalculation";

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

      const { data: streakDays, error: streakDaysError } = await supabase
        .from("reading_streak_days")
        .select("*")
        .eq("user_id", userId)
        .order("activity_date", { ascending: false });

      if (streakDaysError) throw streakDaysError;

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      const calculatedStreak = calculateStreakFromDays(
        (streakDays || []) as ReadingStreakDay[],
        profile
      );
      setStreakData(calculatedStreak);

      const calendar = getActivityCalendarFromDays(
        (streakDays || []) as ReadingStreakDay[],
        90
      );
      setActivityCalendar(calendar);

      const profileCurrentStreak = profile.current_streak || 0;
      const profileLongestStreak = profile.longest_streak || 0;

      if (
        calculatedStreak.currentStreak !== profileCurrentStreak ||
        calculatedStreak.longestStreak !== profileLongestStreak ||
        calculatedStreak.lastReadingDate !== profile.last_reading_date
      ) {
        await supabase
          .from("profiles")
          .update({
            current_streak: calculatedStreak.currentStreak,
            longest_streak: calculatedStreak.longestStreak,
            last_reading_date: calculatedStreak.lastReadingDate,
          })
          .eq("id", userId);

        // Record milestone if new longest streak
        if (calculatedStreak.currentStreak > profileLongestStreak) {
          await supabase.from("reading_streak_history").insert({
            user_id: userId,
            streak_count: calculatedStreak.currentStreak,
            achieved_at: new Date().toISOString(),
          });
        }
      }
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

      const { error: freezeError } = await supabase.rpc("use_reading_streak_freeze", {
        p_user_id: userId,
        p_activity_date: today,
      });

      if (freezeError) throw freezeError;

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
