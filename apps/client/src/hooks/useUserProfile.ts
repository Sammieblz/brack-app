import { getApiErrorStatus } from "@/services/api/client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchUserProfileWithStats, type UserProfileWithStats, type UserStats } from "@/services/api";

const emptyStats: UserStats = { totalBooks: 0, booksRead: 0, currentlyReading: 0, badges: 0 };

export const useUserProfile = (userId: string | null) => {
  const { user } = useAuth();
  const identity = JSON.stringify([user?.id ?? null, userId]);
  const [state, setState] = useState<{
    identity: string | null;
    data: UserProfileWithStats | null;
    loading: boolean;
    error: string | null;
  }>({ identity: null, data: null, loading: true, error: null });
  const [request, setRequest] = useState(0);

  useEffect(() => {
    let active = true;
    setState(previous => ({
      identity,
      data: previous.identity === identity && userId ? previous.data : null,
      loading: Boolean(userId),
      error: null,
    }));
    if (!userId) return () => { active = false; };

    const fetchUserProfile = async () => {
      try {
        const data = await fetchUserProfileWithStats(userId);
        if (active) setState({ identity, data, loading: false, error: null });
      } catch (error: unknown) {
        if (!active) return;
        console.error("Error fetching user profile:", error);
        setState(previous => ({
          identity,
          data: previous.identity === identity && ![401, 403, 404].includes(getApiErrorStatus(error) ?? 0)
            ? previous.data : null,
          loading: false,
          error: "We couldn't load this profile. Please try again.",
        }));
      }
    };

    void fetchUserProfile();
    return () => { active = false; };
  }, [identity, userId, request]);

  const current = state.identity === identity;
  const data = current && userId ? state.data : null;
  return {
    profile: data?.profile ?? null,
    stats: data?.stats ?? emptyStats,
    gamification: data?.gamification ?? null,
    loading: Boolean(userId && (!current || state.loading)),
    error: current ? state.error : null,
    refetch: () => setRequest(value => value + 1),
  };
};
