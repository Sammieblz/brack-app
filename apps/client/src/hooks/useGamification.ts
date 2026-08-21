import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getGamificationShop,
  getGamificationHome,
  getLeaderboard,
  cacheGamificationShopResponse,
  purchaseGamificationShopItem,
  type GamificationShopPurchaseInput,
  type GamificationShopResponse,
  type LeaderboardScope,
} from "@/services/api/gamification";
import { readingCoreSync, SYNC_STATUS_EVENT, type SyncStatusDetail } from "@/services/sync/engine";
import { calculateInkLevelProgress } from "@/lib/gamification";
import {
  getGamificationHomeExpirationDelay,
  getGamificationHomeFreshness,
  getGamificationHomePresentationData,
} from "@/lib/journey";
import { invalidateDashboardHomeQueries } from "@/lib/dashboardQueries";
import {
  getGamificationHomeFetchObservation,
  getGamificationShopFetchObservation,
  recordGamificationHomeFetchObservation,
  recordGamificationShopFetchObservation,
} from "@/lib/gamificationQueries";

export const gamificationQueryKey = (userId?: string) => ["gamification-home", userId];
export const gamificationShopQueryKey = (userId?: string) => ["gamification-shop", userId];

export const useGamification = (userId?: string) => {
  const queryClient = useQueryClient();
  const lastInvalidatedAtRef = useRef(0);
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
  const query = useQuery({
    queryKey: gamificationQueryKey(userId),
    queryFn: async () => {
      try {
        const result = await getGamificationHome(userId!);
        recordGamificationHomeFetchObservation(
          userId!,
          result.source === "live" ? "live" : "cached",
        );
        return result;
      } catch (gamificationError) {
        recordGamificationHomeFetchObservation(userId!, "error");
        throw gamificationError;
      }
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
    // A persisted `source: live` payload is display-only until this mount has
    // observed a current-session request.
    refetchOnMount: "always",
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

  const currentSessionLive = getGamificationHomeFetchObservation(userId).source === "live"
    && query.data?.source === "live"
    && query.isFetchedAfterMount
    && !query.error;
  const presentationData = useMemo(
    () => getGamificationHomePresentationData(
      query.data,
      query.dataUpdatedAt,
      currentSessionLive,
    ),
    [currentSessionLive, query.data, query.dataUpdatedAt],
  );

  useEffect(() => {
    if (!presentationData) return;
    setFreshnessNow(Date.now());
    const receivedAtMs = presentationData.source === "cached"
      ? Date.parse(presentationData.cached_at ?? "")
      : query.dataUpdatedAt;
    const expirationDelay = getGamificationHomeExpirationDelay(
      presentationData,
      receivedAtMs,
    );
    if (expirationDelay <= 0) return;

    const timeout = window.setTimeout(
      () => setFreshnessNow(Date.now()),
      expirationDelay,
    );
    return () => window.clearTimeout(timeout);
  }, [presentationData, query.dataUpdatedAt]);

  const progress = useMemo(
    () => calculateInkLevelProgress(presentationData?.account),
    [presentationData?.account],
  );

  return {
    ...query,
    data: presentationData,
    levelProgress: progress,
    freshness: getGamificationHomeFreshness(
      presentationData,
      freshnessNow,
      query.dataUpdatedAt,
    ),
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
    queryFn: () => getLeaderboard(userId!, scope, weekId),
    enabled: Boolean(userId) && enabled,
    staleTime: 30_000,
  });

export const useGamificationShop = (userId?: string) => {
  const queryClient = useQueryClient();
  const queryKey = gamificationShopQueryKey(userId);
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        const result = await getGamificationShop(userId);
        recordGamificationShopFetchObservation(
          userId!,
          result.source === "live" ? "live" : "cached",
        );
        return result;
      } catch (shopError) {
        recordGamificationShopFetchObservation(userId!, "error");
        throw shopError;
      }
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
    // Economy actions require a response confirmed in this browser session;
    // persisted React Query data is display-only until this request succeeds.
    refetchOnMount: "always",
  });
  const purchaseMutation = useMutation({
    mutationFn: (
      input: Omit<GamificationShopPurchaseInput, "quantity">,
    ) => purchaseGamificationShopItem({ ...input, quantity: 1 }),
    onSuccess: (result) => {
      queryClient.setQueryData<GamificationShopResponse>(queryKey, (current) => {
        if (!current) return current;
        const next: GamificationShopResponse = {
          account: result.account,
          items: current.items.map((item) => {
            const purchasedItem = item.code === result.inventory.item_code;
            const quantity = purchasedItem
              ? result.inventory.quantity
              : item.quantity;
            const maxInventory = purchasedItem
              ? result.inventory.max_inventory
              : item.max_inventory;

            return {
              ...item,
              quantity,
              max_inventory: maxInventory,
              can_purchase:
                (maxInventory <= 0 || quantity < maxInventory)
                && result.account.gold_leaves >= item.gold_leaves_cost,
            };
          }),
          source: "live",
          cached_at: null,
        };
        if (userId) cacheGamificationShopResponse(userId, next);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey });
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: gamificationQueryKey(userId) });
        void invalidateDashboardHomeQueries(queryClient, userId);
      }
    },
  });

  return {
    ...query,
    hasCurrentSessionLiveResponse:
      getGamificationShopFetchObservation(userId).source === "live"
      && query.data?.source === "live"
      && !query.error,
    purchaseMutation,
  };
};
