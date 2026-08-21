import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getDashboardExperience,
  getApiErrorStatus,
  getDashboardJourneyCorrectedNow,
  isDashboardJourneySnapshotExpired,
  type DashboardBookCandidate,
  type DashboardExperienceResult,
  type DashboardExperienceSource,
  type DashboardHomeResponse,
  type DashboardJourneyFreshness,
  type DashboardLastActivityType,
} from "@/services/api";
import {
  cacheGamificationHomeResponse,
  cacheGamificationShopResponse,
  type GamificationHomeResponse,
  type GamificationShopResponse,
} from "@/services/api/gamification";
import { readingCoreSync, SYNC_STATUS_EVENT, type SyncStatusDetail } from "@/services/sync/engine";
import { gamificationQueryKey, gamificationShopQueryKey } from "@/hooks/useGamification";
import {
  claimDashboardHomeForceRefresh,
  dashboardHomeQueryKey,
  getDashboardFetchObservation,
  invalidateDashboardHomeQueries,
  isDashboardEconomyMutationReady,
  recordDashboardFetchObservation,
} from "@/lib/dashboardQueries";

export type {
  DashboardBookCandidate,
  DashboardExperienceResult,
  DashboardHomeResponse,
  DashboardLastActivityType,
};

export { dashboardHomeQueryKey, invalidateDashboardHomeQueries } from "@/lib/dashboardQueries";

interface DashboardRefreshOptions {
  forceRefresh?: boolean;
}

export const useDashboardHomeData = (
  userId?: string,
  includeJourney = false,
) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => dashboardHomeQueryKey(userId, includeJourney, 10),
    [includeJourney, userId],
  );
  const lastInvalidatedAtRef = useRef(0);
  const lastAutoForcedAtRef = useRef(0);
  const deferredForceTimerRef = useRef<number | null>(null);
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
  const fetchBaselineRef = useRef({
    userId,
    generation: getDashboardFetchObservation(userId).generation,
  });
  if (fetchBaselineRef.current.userId !== userId) {
    fetchBaselineRef.current = {
      userId,
      generation: getDashboardFetchObservation(userId).generation,
    };
  }
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const result = await getDashboardExperience(userId!, {
          includeJourney,
          recentLimit: 10,
        });
        recordDashboardFetchObservation(userId!, result.source);
        return result;
      } catch (queryError) {
        recordDashboardFetchObservation(userId!, "error");
        throw queryError;
      }
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
  const pendingSync = useQuery({
    queryKey: ["reading-core-sync-status", userId],
    queryFn: () => readingCoreSync.getStatus(userId),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });

  const forceRefreshDashboard = useCallback(async () => {
    if (!userId) return false;

    const attempt = async (): Promise<boolean> => {
      const gate = claimDashboardHomeForceRefresh(userId);
      if (!gate.allowed) {
        if (deferredForceTimerRef.current === null) {
          deferredForceTimerRef.current = window.setTimeout(() => {
            deferredForceTimerRef.current = null;
            void attempt().catch(() => {
              void invalidateDashboardHomeQueries(queryClient, userId);
            });
          }, gate.retryAfterMs + 25);
        }
        return false;
      }

      try {
        const result = await getDashboardExperience(userId, {
          includeJourney,
          recentLimit: 10,
          forceRefresh: true,
        });
        recordDashboardFetchObservation(userId, result.source);
        queryClient.setQueryData(queryKey, result);
        return true;
      } catch (refreshError) {
        recordDashboardFetchObservation(userId, "error");
        throw refreshError;
      }
    };

    return attempt();
  }, [includeJourney, queryClient, queryKey, userId]);

  useEffect(() => () => {
    if (deferredForceTimerRef.current !== null) {
      window.clearTimeout(deferredForceTimerRef.current);
      deferredForceTimerRef.current = null;
    }
  }, [userId]);

  const refresh = useCallback(async ({ forceRefresh = false }: DashboardRefreshOptions = {}) => {
    if (!userId) return;
    if (forceRefresh) {
      await forceRefreshDashboard();
      return;
    }
    await query.refetch();
  }, [forceRefreshDashboard, query, userId]);

  useEffect(() => {
    if (!userId || !query.data?.data.journey) return;
    const journey = query.data.data.journey;
    const correctedNow = getDashboardJourneyCorrectedNow(
      journey,
      query.data.cachedAt,
    );
    const isCurrentLiveJourney = query.data.source === "live"
      && Date.now() - query.dataUpdatedAt <= 60_000
      && query.data.data.meta?.journey_status === "ok"
      && !isDashboardJourneySnapshotExpired(journey, correctedNow);
    if (!isCurrentLiveJourney) return;

    if (Array.isArray(journey.tomorrow_quests) && Array.isArray(journey.recent_rewards)) {
      const gamificationHome: GamificationHomeResponse = {
        account: journey.account,
        quests: journey.quests,
        tomorrow_quests: journey.tomorrow_quests,
        recent_rewards: journey.recent_rewards,
        league: journey.league,
        week: journey.week,
        server_time: journey.server_time,
        timezone: journey.timezone,
        source: "live",
        cached_at: null,
      };
      queryClient.setQueryData<GamificationHomeResponse>(
        gamificationQueryKey(userId),
        gamificationHome,
      );
      cacheGamificationHomeResponse(userId, gamificationHome);
    }

    if (journey.streak_freeze && query.data.data.meta?.inventory_status === "ok") {
      queryClient.setQueryData<GamificationShopResponse>(
        gamificationShopQueryKey(userId),
        (current) => {
          if (!current) return current;
          const next: GamificationShopResponse = {
            account: {
              user_id: journey.account.user_id,
              gold_leaves: journey.account.gold_leaves,
            },
            items: current.items.map((item) =>
              item.code === journey.streak_freeze?.code
                ? { ...item, ...journey.streak_freeze }
                : item),
            source: "live",
            cached_at: null,
          };
          cacheGamificationShopResponse(userId, next);
          return next;
        },
      );
    }
  }, [query.data, query.dataUpdatedAt, queryClient, userId]);

  useEffect(() => {
    if (!userId) return;

    const invalidateDashboard = () => {
      const invalidationDue = Date.now() - lastInvalidatedAtRef.current > 2_000;
      if (!invalidationDue) return;
      lastInvalidatedAtRef.current = Date.now();
      void invalidateDashboardHomeQueries(queryClient, userId);
    };

    const handleReadingSessionSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId && detail.userId !== userId) return;
      invalidateDashboard();
    };

    const handleSyncStatus = (event: Event) => {
      const detail = (event as CustomEvent<SyncStatusDetail>).detail;
      if (detail.userId !== userId) return;
      queryClient.setQueryData(["reading-core-sync-status", userId], detail);
      if (detail.pending === 0 && detail.syncing === 0 && detail.failed === 0) {
        const now = Date.now();
        if (now - lastAutoForcedAtRef.current >= 30_000) {
          lastAutoForcedAtRef.current = now;
          void forceRefreshDashboard().catch(() => {
            void invalidateDashboardHomeQueries(queryClient, userId);
          });
        }
      }
    };

    const handleBadgesAwarded = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId && detail.userId !== userId) return;
      invalidateDashboard();
    };

    window.addEventListener("readingSessionSaved", handleReadingSessionSaved);
    window.addEventListener("badgesAwarded", handleBadgesAwarded);
    window.addEventListener(SYNC_STATUS_EVENT, handleSyncStatus);
    return () => {
      window.removeEventListener("readingSessionSaved", handleReadingSessionSaved);
      window.removeEventListener("badgesAwarded", handleBadgesAwarded);
      window.removeEventListener(SYNC_STATUS_EVENT, handleSyncStatus);
    };
  }, [forceRefreshDashboard, queryClient, queryKey, userId]);

  const queryErrorStatus = getApiErrorStatus(query.error);
  const rejectsCachedData = Boolean(
    queryErrorStatus
    && queryErrorStatus >= 400
    && queryErrorStatus < 500
    && queryErrorStatus !== 429,
  );
  const dashboardHome = rejectsCachedData ? null : query.data?.data ?? null;
  useEffect(() => {
    if (!dashboardHome?.journey) return;
    const interval = window.setInterval(() => setFreshnessNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [dashboardHome?.journey]);
  const continueBooks = useMemo(() => {
    const candidates = dashboardHome?.continueBooks ?? [];
    const activeBooks = candidates.filter((candidate) => isActiveReadingBook(candidate.book));
    return activeBooks.length > 0
      ? activeBooks
      : candidates.filter((candidate) => candidate.book.status === "to_read");
  }, [dashboardHome?.continueBooks]);

  const provisional = Boolean(
    pendingSync.data
    && (pendingSync.data.pending > 0 || pendingSync.data.syncing > 0),
  );
  const error = query.error instanceof Error
    ? query.error.message
    : query.error
      ? "Failed to load dashboard data"
      : null;
  const effectiveSource: DashboardExperienceSource | null = !rejectsCachedData && query.data
    ? query.data.source
    : null;
  const correctedJourneyNow = getDashboardJourneyCorrectedNow(
    dashboardHome?.journey,
    query.data?.cachedAt,
    freshnessNow,
  );
  const effectiveJourneyFreshness: DashboardJourneyFreshness = !includeJourney
    ? "not_requested"
    : rejectsCachedData
      ? "unavailable"
      : dashboardHome?.journey
        && isDashboardJourneySnapshotExpired(dashboardHome.journey, correctedJourneyNow)
        ? "expired"
        : effectiveSource === "cached" && query.data?.journeyFreshness === "live"
          ? "cached"
          : query.data?.journeyFreshness ?? (query.error ? "unavailable" : "not_requested");
  const currentFetchObservation = getDashboardFetchObservation(userId);
  const hasCurrentSessionLiveResponse =
    currentFetchObservation.generation > fetchBaselineRef.current.generation
    && currentFetchObservation.source === "live"
    && effectiveSource === "live"
    && !query.error;
  const canMutateEconomy = isDashboardEconomyMutationReady({
    hasCurrentSessionLiveResponse,
    hasQueryError: Boolean(query.error),
    source: effectiveSource,
    journeyFreshness: effectiveJourneyFreshness,
    inventoryStatus: dashboardHome?.meta?.inventory_status ?? null,
  });

  return {
    dashboardHome,
    journey: dashboardHome?.journey ?? null,
    continueBooks,
    primaryBook: continueBooks[0] || null,
    secondaryBooks: continueBooks.slice(1, 3),
    loading: Boolean(userId) && query.isPending,
    fetching: query.isFetching,
    error,
    journeyError:
      dashboardHome?.meta?.journey_status === "unavailable"
        ? "Reader Journey is temporarily unavailable"
        : null,
    source: effectiveSource,
    cachedAt: query.data?.cachedAt ?? null,
    journeyFreshness: effectiveJourneyFreshness,
    hasCurrentSessionLiveResponse,
    canMutateEconomy,
    provisional,
    refetch: refresh,
  };
};

const isActiveReadingBook = (book: DashboardBookCandidate["book"]) =>
  book.status === "reading" || (book.current_page || 0) > 0;
