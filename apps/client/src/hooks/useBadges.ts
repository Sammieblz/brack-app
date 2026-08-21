import React, { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Badge, UserBadge } from "@/types";
import { NewBadgeToast } from "@/components/NewBadgeToast";
import { useBadgeCelebration } from "@/contexts/BadgeCelebrationContext";
import {
  awardBadges,
  fetchUserBadges,
  type AwardedBadge,
} from "@/services/api";
import { invalidateDashboardHomeQueries } from "@/lib/dashboardQueries";

interface BadgesAwardedEventDetail {
  userId?: string;
  badges?: AwardedBadge[];
}

export const useBadges = (userId?: string, enabled = true) => {
  const queryClient = useQueryClient();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { showCelebration } = useBadgeCelebration();

  const fetchBadges = useCallback(async () => {
    if (!userId || !enabled) return;

    try {
      setLoading(true);

      const data = await fetchUserBadges(userId);
      setBadges(data.badges);
      setEarnedBadges(data.earnedBadges);
    } catch (error: unknown) {
      console.error("Error fetching badges:", error);
    } finally {
      setLoading(false);
    }
  }, [enabled, userId]);

  const notifyNewBadges = useCallback(
    async (newBadges: AwardedBadge[]) => {
      if (!userId || newBadges.length === 0) return;

      await fetchBadges();
      void invalidateDashboardHomeQueries(queryClient, userId);

      for (const badge of newBadges) {
        toast({
          title: "New Badge Earned!",
          description: React.createElement(NewBadgeToast, { badge }),
        });

        showCelebration(badge);
      }
    },
    [fetchBadges, queryClient, showCelebration, toast, userId]
  );

  useEffect(() => {
    if (userId && enabled) {
      void fetchBadges();
    }
  }, [enabled, fetchBadges, userId]);

  useEffect(() => {
    if (!userId) return;

    const handleBadgesAwarded = (event: Event) => {
      const detail = (event as CustomEvent<BadgesAwardedEventDetail>).detail;
      if (detail?.userId !== userId || !detail.badges?.length) return;

      void notifyNewBadges(detail.badges);
    };

    window.addEventListener("badgesAwarded", handleBadgesAwarded);

    return () => {
      window.removeEventListener("badgesAwarded", handleBadgesAwarded);
    };
  }, [notifyNewBadges, userId]);

  const checkAndAwardBadges = useCallback(
    async () => {
      if (!userId || !enabled) return;

      try {
        const result = await awardBadges("manual_check");
        const newBadges = result.awarded_badges || [];
        await notifyNewBadges(newBadges);
      } catch (error) {
        console.error("Error checking badges:", error);
      }
    },
    [enabled, notifyNewBadges, userId]
  );

  return {
    badges,
    earnedBadges,
    loading,
    refetchBadges: fetchBadges,
    checkAndAwardBadges,
  };
};
