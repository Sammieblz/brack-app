import { supabase } from "@/integrations/supabase/client";
import type { ReadingStreakDay } from "@/types";
import {
  calculateStreakFromDays,
  getActivityCalendarFromDays,
  type DayActivity,
  type StreakData,
} from "@/utils/streakCalculation";

export interface StreakMilestone {
  id: string;
  user_id: string;
  streak_count: number;
  achieved_at: string;
  created_at: string;
}

export interface StreakSummary {
  streakData: StreakData;
  activityCalendar: DayActivity[];
}

export const fetchStreakSummary = async (
  userId: string
): Promise<StreakSummary> => {
  const { data: streakDays, error: streakDaysError } = await supabase
    .from("reading_streak_days")
    .select("*")
    .eq("user_id", userId)
    .order("activity_date", { ascending: false });

  if (streakDaysError) throw streakDaysError;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError) throw profileError;

  const days = (streakDays || []) as ReadingStreakDay[];
  const calculatedStreak = calculateStreakFromDays(days, profile);
  const activityCalendar = getActivityCalendarFromDays(days, 90);

  return {
    streakData: calculatedStreak,
    activityCalendar,
  };
};

export const applyReadingStreakFreeze = async (
  userId: string,
  activityDate: string
): Promise<void> => {
  const { error } = await supabase.rpc("use_reading_streak_freeze", {
    p_user_id: userId,
    p_activity_date: activityDate,
  });

  if (error) throw error;
};

export const fetchStreakHistory = async (
  userId: string
): Promise<StreakMilestone[]> => {
  const { data, error } = await supabase
    .from("reading_streak_history")
    .select("*")
    .eq("user_id", userId)
    .order("streak_count", { ascending: false })
    .order("achieved_at", { ascending: false });

  if (error) throw error;
  return data || [];
};
