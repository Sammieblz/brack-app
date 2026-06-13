import { Capacitor } from "@capacitor/core";
import { getAbsoluteBadgeImageUrl } from "@/lib/badgeImages";
import { sendPushNotification, type AwardedBadge } from "@/services/api";

export const badgeNotificationService = {
  async notifyBadgeEarned(userId: string, badge: AwardedBadge): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const imageUrl = getAbsoluteBadgeImageUrl(badge);
    await sendPushNotification({
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
    });
  },
};
