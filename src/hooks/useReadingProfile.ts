import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOnboardingErrorMessage } from "@/services/onboarding";
import type { ReadingHabits, UserLearningProfile } from "@/types";

interface UseReadingProfileOptions {
  includeLearningProfile?: boolean;
}

export const useReadingProfile = (
  userId?: string,
  { includeLearningProfile = false }: UseReadingProfileOptions = {},
) => {
  const [habits, setHabits] = useState<ReadingHabits | null>(null);
  const [learningProfile, setLearningProfile] = useState<UserLearningProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setHabits(null);
      setLearningProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: habitData, error: habitError } = await supabase
        .from("reading_habits")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (habitError && habitError.code !== "PGRST116") throw habitError;

      setHabits((habitData as ReadingHabits | null) ?? null);

      if (includeLearningProfile) {
        const { data: learningData, error: learningError } = await supabase
          .from("user_learning_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (learningError && learningError.code !== "PGRST116") throw learningError;
        setLearningProfile((learningData as unknown as UserLearningProfile | null) ?? null);
      } else {
        setLearningProfile(null);
      }
    } catch (err) {
      setError(getOnboardingErrorMessage(err, "Unable to load reading profile"));
      setHabits(null);
      setLearningProfile(null);
    } finally {
      setLoading(false);
    }
  }, [includeLearningProfile, userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    habits,
    learningProfile,
    loading,
    error,
    refetch,
  };
};
