import { useQuery } from "@tanstack/react-query";
import {
  getOnboardingErrorMessage,
  getOnboardingStatus,
} from "@/services/onboarding";

export const useOnboardingStatus = (userId?: string) => {
  const query = useQuery({
    queryKey: ["onboarding-status", userId],
    queryFn: () => getOnboardingStatus(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });

  return {
    status: query.data ?? null,
    loading: Boolean(userId) && query.isLoading,
    error: query.error
      ? getOnboardingErrorMessage(query.error, "Unable to load onboarding status")
      : null,
    refetch: query.refetch,
  };
};
