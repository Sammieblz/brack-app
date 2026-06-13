import type { Badge } from "@/types";
import { getBadgeImagePath } from "@/lib/badgeImages";

interface NewBadgeToastProps {
  badge: Badge;
}

export const NewBadgeToast = ({ badge }: NewBadgeToastProps) => {
  const imagePath = getBadgeImagePath(badge);

  return (
    <div className="flex items-center gap-3">
      {imagePath && (
        <div className="shrink-0">
          <img
            src={imagePath}
            alt={badge.title}
            className="h-10 w-10 rounded-md object-contain"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex-1">
        <div className="font-sans font-semibold">New Badge Earned!</div>
        <div className="font-sans text-sm">
          <span className="font-semibold">{badge.title}</span>
          {badge.description ? ` — ${badge.description}` : null}
        </div>
      </div>
    </div>
  );
};

