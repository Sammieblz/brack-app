import React, { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import type { Badge, UserBadge } from "@/types";
import { getAbsoluteBadgeImageUrl } from "@/lib/badgeImages";
import { NewBadgeToast } from "@/components/NewBadgeToast";
import { useBadgeCelebration } from "@/contexts/BadgeCelebrationContext";
import {
  awardBadges,
  fetchUserBadges,
  sendPushNotification,
  type AwardedBadge,
} from "@/services/api";

interface BadgesAwardedEventDetail {
  userId?: string;
  badges?: AwardedBadge[];
}

export const useBadges = (userId?: string) => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { showCelebration } = useBadgeCelebration();

  const fetchBadges = useCallback(async () => {
    if (!userId) return;

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
  }, [userId]);

  const notifyNewBadges = useCallback(
    async (newBadges: AwardedBadge[]) => {
      if (!userId || newBadges.length === 0) return;

      await fetchBadges();

      for (const badge of newBadges) {
        toast({
          title: "New Badge Earned!",
          description: React.createElement(NewBadgeToast, { badge }),
        });

        if (Capacitor.isNativePlatform()) {
          const imageUrl = getAbsoluteBadgeImageUrl(badge);
          sendPushNotification({
            user_ids: [userId],
            notification: {
              title: "New Badge Earned!",
              body: `${badge.title}${badge.description ? ` - ${badge.description}` : ""}`,
              image: imageUrl ?? undefined,
              data: {
                type: "badge_earned",
                badgeId: badge.id,
                badgeTitle: badge.title,
                badgeDescription: badge.description,
                badgeImageUrl: imageUrl ?? null,
              },
            },
          }).catch((error) => {
            console.error("Error sending badge push notification:", error);
          });
        }

        showCelebration(badge);
      }
    },
    [fetchBadges, showCelebration, toast, userId]
  );

  useEffect(() => {
    if (userId) {
      void fetchBadges();
    }
  }, [fetchBadges, userId]);

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
      if (!userId) return;

      try {
        const result = await awardBadges("manual_check");
        const newBadges = result.awarded_badges || [];
        await notifyNewBadges(newBadges);
      } catch (error) {
        console.error("Error checking badges:", error);
      }
    },
    [notifyNewBadges, userId]
  );

  return {
    badges,
    earnedBadges,
    loading,
    refetchBadges: fetchBadges,
    checkAndAwardBadges,
  };
};
