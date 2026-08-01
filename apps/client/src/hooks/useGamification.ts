import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import {
  getGamificationHome,
  getLeaderboard,
  type LeaderboardScope,
} from "@/services/api/gamification";
import { readingCoreSync, SYNC_STATUS_EVENT, type SyncStatusDetail } from "@/services/sync/engine";
import { calculateInkLevelProgress } from "@/lib/gamification";

export const gamificationQueryKey = (userId?: string) => ["gamification-home", userId];

export const useGamification = (userId?: string) => {
  const queryClient = useQueryClient();
  const lastInvalidatedAtRef = useRef(0);
  const query = useQuery({
    queryKey: gamificationQueryKey(userId),
    queryFn: () => getGamificationHome(userId!),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
  const pendingSync = useQuery({
    queryKey: ["reading-core-sync-status", userId],
    queryFn: () => readingCoreSync.getStatus(userId),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!userId) return;
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<SyncStatusDetail>).detail;
      if (detail.userId !== userId) return;
      queryClient.setQueryData(["reading-core-sync-status", userId], detail);
      const cleanSync = detail.pending === 0 && detail.syncing === 0 && detail.failed === 0;
      const invalidationDue = Date.now() - lastInvalidatedAtRef.current > 30_000;
      if (cleanSync && invalidationDue) {
        lastInvalidatedAtRef.current = Date.now();
        void queryClient.invalidateQueries({ queryKey: gamificationQueryKey(userId) });
      }
    };
    window.addEventListener(SYNC_STATUS_EVENT, listener);
    return () => window.removeEventListener(SYNC_STATUS_EVENT, listener);
  }, [queryClient, userId]);

  const progress = useMemo(
    () => calculateInkLevelProgress(query.data?.account),
    [query.data?.account],
  );

  return {
    ...query,
    levelProgress: progress,
    provisional: Boolean(
      pendingSync.data &&
      (pendingSync.data.pending > 0 || pendingSync.data.syncing > 0),
    ),
  };
};

export const useLeaderboard = (
  userId: string | undefined,
  scope: LeaderboardScope,
  weekId?: string | null,
  enabled = true,
) =>
  useQuery({
    queryKey: ["reader-leaderboard", userId, scope, weekId],
    queryFn: () => getLeaderboard(scope, weekId),
    enabled: Boolean(userId) && enabled,
    staleTime: 30_000,
  });
