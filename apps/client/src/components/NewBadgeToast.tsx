import type { Badge } from "@/types";
import { BadgeEmblem } from "@/components/BadgeEmblem";

type BadgeToastDetails =
  | Badge
  | {
      id: string;
      title: string;
      description: string | null;
      icon_url?: string | null;
    };

interface NewBadgeToastProps {
  badge: BadgeToastDetails;
}

const isCatalogBadge = (badge: BadgeToastDetails): badge is Badge => "code" in badge;

export const NewBadgeToast = ({ badge }: NewBadgeToastProps) => {
  return (
    <div className="flex items-center gap-3">
      {isCatalogBadge(badge) ? (
        <BadgeEmblem badge={badge} earned size="sm" className="shrink-0" />
      ) : badge.icon_url ? (
        <img
          src={badge.icon_url}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10 font-display text-lg font-semibold text-primary"
          aria-hidden="true"
        >
          {badge.title.trim().charAt(0).toUpperCase() || "★"}
        </div>
      )}
      <div className="flex-1">
        <div className="font-sans font-semibold">New Badge Earned!</div>
        <div className="font-sans text-sm">
          <span className="font-semibold">{badge.title}</span>
          {badge.description ? ` - ${badge.description}` : null}
        </div>
      </div>
    </div>
  );
};
