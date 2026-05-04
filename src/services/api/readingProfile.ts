import { supabase } from "@/integrations/supabase/client";
import type { ReadingHabits, UserLearningProfile } from "@/types";

export interface ReadingProfileResult {
  habits: ReadingHabits | null;
  learningProfile: UserLearningProfile | null;
}

export const fetchReadingProfile = async (
  userId: string,
  includeLearningProfile = false
): Promise<ReadingProfileResult> => {
  const { data: habitData, error: habitError } = await supabase
    .from("reading_habits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (habitError && habitError.code !== "PGRST116") throw habitError;

  if (!includeLearningProfile) {
    return {
      habits: (habitData as ReadingHabits | null) ?? null,
      learningProfile: null,
    };
  }

  const { data: learningData, error: learningError } = await supabase
    .from("user_learning_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (learningError && learningError.code !== "PGRST116") throw learningError;

  return {
    habits: (habitData as ReadingHabits | null) ?? null,
    learningProfile:
      (learningData as unknown as UserLearningProfile | null) ?? null,
  };
};

export const upsertReadingHabits = async (
  habits: Partial<ReadingHabits> & { user_id: string }
): Promise<void> => {
  const { error } = await supabase
    .from("reading_habits")
    .upsert(habits, { onConflict: "user_id" });

  if (error) throw error;
};
