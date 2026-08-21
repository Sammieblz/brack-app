import { useEffect, useState } from "react";
import type { Badge } from "@/types";
import { APP_ICONS, type AppIcon as AppIconType } from "@/config/iconography";
import { getBadgeImagePath } from "@/lib/badgeImages";
import { cn } from "@/lib/utils";

const ICON_KEY_MAP: Record<string, AppIconType> = {
  book: APP_ICONS.badges.book,
  "book-stack": APP_ICONS.badges.bookStack,
  bookshelf: APP_ICONS.badges.bookshelf,
  library: APP_ICONS.badges.library,
  "bookmark-book": APP_ICONS.badges.bookmarkBook,
  "badge-check": APP_ICONS.badges.badgeCheck,
  "check-circle": APP_ICONS.badges.checkCircle,
  "open-book": APP_ICONS.badges.openBook,
  medal: APP_ICONS.badges.medal,
  "medal-first": APP_ICONS.badges.medalFirst,
  trophy: APP_ICONS.badges.trophy,
  fire: APP_ICONS.badges.fire,
  "calendar-check": APP_ICONS.badges.calendarCheck,
  "leaderboard-star": APP_ICONS.badges.leaderboardStar,
  clock: APP_ICONS.badges.clock,
  timer: APP_ICONS.badges.timer,
  hourglass: APP_ICONS.badges.hourglass,
  sunrise: APP_ICONS.badges.sunrise,
  moon: APP_ICONS.badges.moon,
  page: APP_ICONS.badges.page,
  "page-right": APP_ICONS.badges.pageRight,
  "multiple-pages": APP_ICONS.badges.multiplePages,
  compass: APP_ICONS.badges.compass,
  map: APP_ICONS.badges.map,
  user: APP_ICONS.badges.user,
  community: APP_ICONS.badges.community,
  flash: APP_ICONS.badges.flash,
  list: APP_ICONS.badges.list,
  star: APP_ICONS.badges.star,
  reports: APP_ICONS.badges.reports,
  flag: APP_ICONS.badges.flag,
  target: APP_ICONS.badges.target,
  spark: APP_ICONS.badges.spark,
  leaderboard: APP_ICONS.badges.leaderboard,
};

const rarityClasses = {
  common: "border-border bg-muted/60 text-muted-foreground",
  uncommon: "border-dashed border-primary/30 bg-primary/5 text-primary",
  rare: "border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/10",
  epic: "border-[3px] border-double border-primary/50 bg-primary/10 text-primary",
  legendary: "border-primary/60 bg-gradient-card text-primary ring-2 ring-primary/20",
} as const;

interface BadgeEmblemProps {
  badge: Badge;
  earned?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const BadgeEmblem = ({
  badge,
  earned = false,
  size = "md",
  className,
}: BadgeEmblemProps) => {
  const imagePath = getBadgeImagePath(badge);
  const [imageFailed, setImageFailed] = useState(false);
  const Icon =
    (badge.icon_key && ICON_KEY_MAP[badge.icon_key]) ||
    APP_ICONS.badges[badge.category] ||
    APP_ICONS.journey.badges;
  const dimensions = {
    sm: "h-12 w-12",
    md: "h-20 w-20",
    lg: "h-32 w-32",
  }[size];
  const imageDimensions = {
    sm: "h-12 w-12",
    md: "h-20 w-20",
    lg: "h-32 w-32",
  }[size];

  useEffect(() => {
    setImageFailed(false);
  }, [imagePath]);

  if (imagePath && !imageFailed) {
    return (
      <div className={cn("relative grid place-items-center", dimensions, className)}>
        <img
          src={imagePath}
          alt=""
          className={cn(
            "select-none object-contain",
            imageDimensions,
            !earned && "grayscale opacity-45",
          )}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative grid place-items-center rounded-full border shadow-sm",
        dimensions,
        rarityClasses[badge.rarity],
        !earned && "grayscale opacity-55",
        className,
      )}
      aria-hidden="true"
    >
      <Icon
        className={cn(
          size === "sm" && "h-5 w-5",
          size === "md" && "h-8 w-8",
          size === "lg" && "h-12 w-12",
        )}
      />
      <span className="absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full border border-background bg-foreground px-1 text-[10px] font-semibold text-background">
        {badge.tier}
      </span>
    </div>
  );
};
