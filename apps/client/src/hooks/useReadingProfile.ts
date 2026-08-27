import { useQuery } from "@tanstack/react-query";
import { getOnboardingErrorMessage } from "@/services/onboarding";
import { fetchReadingProfile } from "@/services/api";

interface UseReadingProfileOptions {
  includeLearningProfile?: boolean;
}

export const useReadingProfile = (
  userId?: string,
  { includeLearningProfile = false }: UseReadingProfileOptions = {},
) => {
  const query = useQuery({
    queryKey: ["reading-profile", userId, { includeLearningProfile }],
    queryFn: () => fetchReadingProfile(userId!, includeLearningProfile),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });

  return {
    habits: query.data?.habits ?? null,
    learningProfile: query.data?.learningProfile ?? null,
    loading: Boolean(userId) && query.isLoading,
    error: query.error
      ? getOnboardingErrorMessage(query.error, "Unable to load reading profile")
      : null,
    refetch: query.refetch,
  };
};
