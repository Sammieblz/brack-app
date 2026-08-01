import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge as BadgeChip } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BadgeEmblem } from "@/components/BadgeEmblem";
import type { Badge, BadgeCategory, UserBadge } from "@/types";
import { cn } from "@/lib/utils";

interface BadgeDisplayProps {
  badges: Badge[];
  earnedBadges: UserBadge[];
  onBadgeClick?: (badge: Badge, earnedBadge?: UserBadge) => void;
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
  common: "text-muted-foreground",
  uncommon: "text-emerald-700 dark:text-emerald-300",
  rare: "text-sky-700 dark:text-sky-300",
  epic: "text-violet-700 dark:text-violet-300",
  legendary: "text-amber-700 dark:text-amber-300",
} as const;

export const BadgeDisplay = ({
  badges,
  earnedBadges,
  onBadgeClick,
}: BadgeDisplayProps) => {
  const showFilters = badges.length > 8;
  const [category, setCategory] = useState<BadgeCategory | "all">("all");
  const earnedBadgeById = useMemo(
    () => new Map(earnedBadges.map((earned) => [earned.badge_id, earned])),
    [earnedBadges],
  );
  const categories = useMemo(
    () =>
      Array.from(new Set(badges.map((badge) => badge.category))) as BadgeCategory[],
    [badges],
  );
  const visibleBadges = useMemo(
    () =>
      badges.filter((badge) => category === "all" || badge.category === category),
    [badges, category],
  );

  return (
    <div className="space-y-4">
      {showFilters && (
        <div
          className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Badge categories"
        >
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
              category === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            All {badges.length}
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
                onClick={() => setCategory(item)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visibleBadges.map((badge) => {
          const earnedBadge = earnedBadgeById.get(badge.id);
          const isEarned = Boolean(earnedBadge);
          const progress = isEarned ? 100 : badge.progress_percentage || 0;

          return (
            <Card
              key={badge.id}
              role={onBadgeClick ? "button" : undefined}
              tabIndex={onBadgeClick ? 0 : undefined}
              onClick={() => onBadgeClick?.(badge, earnedBadge)}
              onKeyDown={(event) => {
                if (!onBadgeClick || (event.key !== "Enter" && event.key !== " ")) return;
                event.preventDefault();
                onBadgeClick(badge, earnedBadge);
              }}
              className={cn(
                "overflow-hidden transition-colors",
                showFilters ? "min-h-64" : "min-h-52",
                onBadgeClick && "cursor-pointer hover:border-primary/45",
                !isEarned && "bg-muted/20",
              )}
            >
              <CardContent className="flex h-full flex-col items-center gap-3 p-4 text-center">
                <BadgeEmblem badge={badge} earned={isEarned} />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <h3
                      className={cn(
                        "font-sans text-sm font-semibold",
                        !isEarned && "text-muted-foreground",
                      )}
                    >
                      {badge.title}
                    </h3>
                    <BadgeChip
                      variant="outline"
                      className={cn(
                        "px-1.5 py-0 text-[10px] capitalize",
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
                    <span>{isEarned ? "Unlocked" : `Tier ${badge.tier}`}</span>
                    <span>
                      {Math.min(badge.progress_value || 0, badge.target_value).toLocaleString()}
                      /{badge.target_value.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
