import { useCallback, useEffect, useState } from "react";
import { getOnboardingErrorMessage } from "@/services/onboarding";
import { fetchReadingProfile } from "@/services/api";
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

      const data = await fetchReadingProfile(userId, includeLearningProfile);
      setHabits(data.habits);
      setLearningProfile(data.learningProfile);
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
