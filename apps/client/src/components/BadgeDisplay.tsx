import { useEffect, useMemo, useState } from "react";
import { Badge as BadgeChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BadgeEmblem } from "@/components/BadgeEmblem";
import type { Badge, BadgeCategory, UserBadge } from "@/types";
import { cn } from "@/lib/utils";

type BadgeStatusFilter = "in_progress" | "earned" | "all";

interface BadgeDisplayProps {
  badges: Badge[];
  earnedBadges: UserBadge[];
  onBadgeClick?: (badge: Badge, earnedBadge?: UserBadge) => void;
  catalog?: boolean;
  initialStatus?: BadgeStatusFilter;
  pageSize?: number;
}

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  collection: "Collection",
  completion: "Completion",
  streak: "Streaks",
  time: "Reading time",
  pages: "Pages",
  exploration: "Exploration",
  craft: "Reading craft",
  journey: "Journey",
};
const rarityClasses = {
  common: "rounded-full border-border bg-muted/50",
  uncommon: "rounded-md border-primary/[0.22] bg-primary/[0.05]",
  rare: "rounded-sm border-2 border-primary/[0.3] bg-primary/[0.07]",
  epic: "rounded-none border-2 border-double border-primary/[0.38] bg-primary/[0.09]",
  legendary: "rounded-full border-2 border-primary/[0.48] bg-primary/[0.12] shadow-sm",
} as const;

const statusLabels: Record<BadgeStatusFilter, string> = {
  in_progress: "In progress",
  earned: "Earned",
  all: "All",
};

export const BadgeDisplay = ({
  badges,
  earnedBadges,
  onBadgeClick,
  catalog = false,
  initialStatus = "in_progress",
  pageSize = 12,
}: BadgeDisplayProps) => {
  const showFilters = catalog || badges.length > 8;
  const [category, setCategory] = useState<BadgeCategory | "all">("all");
  const [status, setStatus] = useState<BadgeStatusFilter>(
    catalog ? initialStatus : "all",
  );
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const earnedBadgeById = useMemo(
    () => new Map(earnedBadges.map((earned) => [earned.badge_id, earned])),
    [earnedBadges],
  );
  const categories = useMemo(
    () => Array.from(new Set(badges.map((badge) => badge.category))) as BadgeCategory[],
    [badges],
  );

  const filteredBadges = useMemo(() => {
    const filtered = badges.filter((badge) => {
      const earned = earnedBadgeById.has(badge.id);
      const matchesStatus = status === "all"
        || (status === "earned" ? earned : !earned);
      return matchesStatus && (category === "all" || badge.category === category);
    });

    return filtered.sort((left, right) => {
      const leftEarned = earnedBadgeById.get(left.id);
      const rightEarned = earnedBadgeById.get(right.id);
      if (leftEarned && rightEarned) {
        return rightEarned.earned_at.localeCompare(leftEarned.earned_at)
          || left.sort_order - right.sort_order;
      }
      if (!leftEarned && !rightEarned) {
        return (right.progress_percentage ?? 0) - (left.progress_percentage ?? 0)
          || left.sort_order - right.sort_order;
      }
      return leftEarned ? -1 : 1;
    });
  }, [badges, category, earnedBadgeById, status]);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [category, pageSize, status]);

  const visibleBadges = catalog
    ? filteredBadges.slice(0, visibleCount)
    : filteredBadges;

  const selectStatus = (nextStatus: BadgeStatusFilter) => {
    setStatus(nextStatus);
    setVisibleCount(pageSize);
  };

  const selectCategory = (nextCategory: BadgeCategory | "all") => {
    setCategory(nextCategory);
    setVisibleCount(pageSize);
  };

  return (
    <div className="space-y-5">
      {catalog && (
        <div
          className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Badge status"
        >
          {(Object.keys(statusLabels) as BadgeStatusFilter[]).map((item) => {
            const count = badges.filter((badge) => {
              const earned = earnedBadgeById.has(badge.id);
              return item === "all" || (item === "earned" ? earned : !earned);
            }).length;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={status === item}
                onClick={() => selectStatus(item)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  status === item
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                {statusLabels[item]} {count}
              </button>
            );
          })}
        </div>
      )}

      {showFilters && categories.length > 1 && (
        <div
          className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Badge categories"
        >
          <button
            type="button"
            aria-pressed={category === "all"}
            onClick={() => selectCategory("all")}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              category === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            All categories
          </button>
          {categories.map((item) => {
            const categoryBadges = badges.filter((badge) => badge.category === item);
            const earnedCount = categoryBadges.filter((badge) =>
              earnedBadgeById.has(badge.id),
            ).length;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => selectCategory(item)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full border px-4 text-sm transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  category === item
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                {CATEGORY_LABELS[item]} {earnedCount}/{categoryBadges.length}
              </button>
            );
          })}
        </div>
      )}

      {visibleBadges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 px-5 py-10 text-center">
          <p className="font-medium">
            {status === "earned" ? "No badges earned here yet" : "No badges match these filters"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === "earned"
              ? "Your next milestone will appear here once it is unlocked."
              : "Choose another status or category to keep exploring."}
          </p>
          {(status !== "all" || category !== "all") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4 min-h-11"
              onClick={() => {
                selectStatus("all");
                selectCategory("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
          {visibleBadges.map((badge) => {
            const earnedBadge = earnedBadgeById.get(badge.id);
            const isEarned = Boolean(earnedBadge);
            const progress = isEarned ? 100 : badge.progress_percentage || 0;
            const content = (
              <CardContent className="flex h-full min-h-60 flex-col items-center gap-3 p-4 text-center">
                <BadgeEmblem badge={badge} earned={isEarned} />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <h3 className="font-sans text-sm font-semibold">
                      {badge.title}
                    </h3>
                    <BadgeChip
                      variant="outline"
                      className={cn(
                        "px-1.5 py-0 text-[10px] capitalize text-foreground",
                        rarityClasses[badge.rarity],
                      )}
                    >
                      {badge.rarity}
                    </BadgeChip>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {badge.description}
                  </p>
                </div>

                <div className="mt-auto w-full space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{isEarned ? "Earned" : "Locked · In progress"}</span>
                    <span>
                      {Math.min(badge.progress_value || 0, badge.target_value).toLocaleString()}
                      /{badge.target_value.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={progress}
                    className="h-1.5"
                    aria-label={`${badge.title}: ${Math.round(progress)}% complete`}
                  />
                </div>
              </CardContent>
            );

            return (
              <Card
                key={badge.id}
                className={cn(
                  "group relative h-full overflow-hidden transition-colors",
                  onBadgeClick && "hover:border-primary/[0.38]",
                  !isEarned && "bg-muted/20",
                )}
              >
                {onBadgeClick && (
                  <button
                    type="button"
                    onClick={() => onBadgeClick(badge, earnedBadge)}
                    className={cn(
                      "absolute inset-0 z-10 rounded-[inherit] transition-colors",
                      "hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    )}
                    aria-label={`${badge.title}, ${isEarned ? "earned" : `${Math.round(progress)}% complete`}`}
                  />
                )}
                {content}
              </Card>
            );
          })}
        </div>
      )}

      {catalog && filteredBadges.length > visibleCount && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 min-w-36"
            onClick={() => setVisibleCount((current) => current + pageSize)}
          >
            Show {Math.min(pageSize, filteredBadges.length - visibleCount)} more
          </Button>
        </div>
      )}
    </div>
  );
};
