import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { calculateStreakFromSessions, getActivityCalendar } from "@/utils/streakCalculation";
import type { ReadingSession, Profile } from "@/types";
import type { StreakData, DayActivity } from "@/utils/streakCalculation";

export const useStreaks = (userId?: string) => {
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastReadingDate: null,
    canUseFreezeToday: false,
    freezeAvailable: true,
  });
  const [activityCalendar, setActivityCalendar] = useState<DayActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      fetchStreakData();
    }
  }, [userId]);

  const fetchStreakData = async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Fetch reading sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from("reading_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (sessionsError) throw sessionsError;

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) throw profileError;

      // Calculate streak data
      const calculatedStreak = calculateStreakFromSessions(
        sessions || [],
        profile
      );
      setStreakData(calculatedStreak);

      // Generate activity calendar
      const calendar = getActivityCalendar(sessions || [], 90);
      setActivityCalendar(calendar);

      // Update profile if streak changed
      if (
        calculatedStreak.currentStreak !== profile.current_streak ||
        calculatedStreak.longestStreak !== profile.longest_streak
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
        if (calculatedStreak.currentStreak > (profile.longest_streak || 0)) {
          await supabase.from("reading_streak_history").insert({
            user_id: userId,
            streak_count: calculatedStreak.currentStreak,
            achieved_at: new Date().toISOString(),
          });
        }
      }
    } catch (error: any) {
      console.error("Error fetching streak data:", error);
    } finally {
      setLoading(false);
    }
  };

  const useStreakFreeze = async () => {
    if (!userId || !streakData.freezeAvailable) return false;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          streak_freeze_used_at: new Date().toISOString(),
          last_reading_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Streak Freeze Used!",
        description: "Your streak has been preserved for today. You can use this again in 7 days.",
      });

      await fetchStreakData();
      return true;
    } catch (error: any) {
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
