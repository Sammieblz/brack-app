import { BadgeDisplay } from "@/components/BadgeDisplay";
import {
  LoadingError,
  LoadingRegion,
} from "@/components/loading/LoadingRegion";
import { JourneyBadgesSkeleton } from "@/components/skeletons/JourneySkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { JourneySectionEyebrow } from "@/components/journey/JourneySurface";
import type { Badge, UserBadge } from "@/types";

interface JourneyBadgesProps {
  badges: Badge[];
  earnedBadges: UserBadge[];
  loading: boolean;
  refreshing?: boolean;
  error?: Error | null;
  hasLoaded?: boolean;
  onRetry?: () => void;
  onBadgeClick: (badge: Badge, earnedBadge?: UserBadge) => void;
}

export const JourneyBadges = ({
  badges,
  earnedBadges,
  loading,
  refreshing,
  error,
  hasLoaded = true,
  onRetry,
  onBadgeClick,
}: JourneyBadgesProps) => (
  <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <JourneySectionEyebrow>Milestone collection</JourneySectionEyebrow>
        <h2 className="font-display text-2xl font-bold">Badges</h2>
        <div className="mt-1 text-sm text-muted-foreground">
          {loading ? (
            <Skeleton className="h-5 w-32" />
          ) : (
            `${earnedBadges.length} of ${badges.length} unlocked`
          )}
        </div>
      </div>
    </div>
    <LoadingRegion
      loading={loading}
      refreshing={refreshing}
      label="Loading badges"
    >
      {error && (
        <LoadingError
          message="Badges could not be refreshed. Your milestones are safe."
          onRetry={onRetry}
        />
      )}
      {loading ? (
        <JourneyBadgesSkeleton />
      ) : badges.length === 0 && (!error || hasLoaded) ? (
        <PremiumEmptyState
          asset="emptyGoals"
          title="No badges configured"
          description="Badge milestones will appear here when available."
          size="compact"
        />
      ) : badges.length > 0 ? (
        <BadgeDisplay
          badges={badges}
          earnedBadges={earnedBadges}
          onBadgeClick={onBadgeClick}
          catalog
          initialStatus="in_progress"
          pageSize={12}
        />
      ) : null}
    </LoadingRegion>
  </div>
);
