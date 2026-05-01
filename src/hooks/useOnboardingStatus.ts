import { useCallback, useEffect, useState } from "react";
import {
  getOnboardingErrorMessage,
  getOnboardingStatus,
  type OnboardingStatusRecord,
} from "@/services/onboarding";

export const useOnboardingStatus = (userId?: string) => {
  const [status, setStatus] = useState<OnboardingStatusRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setStatus(await getOnboardingStatus(userId));
    } catch (err) {
      setError(getOnboardingErrorMessage(err, "Unable to load onboarding status"));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    status,
    loading,
    error,
    refetch,
  };
};
