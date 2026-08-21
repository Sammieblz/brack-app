import { BadgeDisplay } from "@/components/BadgeDisplay";
import LoadingSpinner from "@/components/LoadingSpinner";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { JourneySectionEyebrow } from "@/components/journey/JourneySurface";
import type { Badge, UserBadge } from "@/types";

interface JourneyBadgesProps {
  badges: Badge[];
  earnedBadges: UserBadge[];
  loading: boolean;
  onBadgeClick: (badge: Badge, earnedBadge?: UserBadge) => void;
}

export const JourneyBadges = ({
  badges,
  earnedBadges,
  loading,
  onBadgeClick,
}: JourneyBadgesProps) => (
  <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <JourneySectionEyebrow>Milestone collection</JourneySectionEyebrow>
        <h2 className="font-display text-2xl font-bold">Badges</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {earnedBadges.length} of {badges.length} unlocked
        </p>
      </div>
    </div>
    {loading ? (
      <div className="flex min-h-72 items-center justify-center">
        <LoadingSpinner text="Loading badges..." />
      </div>
    ) : badges.length === 0 ? (
      <PremiumEmptyState
        asset="emptyGoals"
        title="No badges configured"
        description="Badge milestones will appear here when available."
        size="compact"
      />
    ) : (
      <BadgeDisplay
        badges={badges}
        earnedBadges={earnedBadges}
        onBadgeClick={onBadgeClick}
        catalog
        initialStatus="in_progress"
        pageSize={12}
      />
    )}
  </div>
);

