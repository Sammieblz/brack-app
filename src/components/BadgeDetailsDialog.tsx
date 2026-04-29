import type { Badge, UserBadge } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getBadgeImagePath } from "@/lib/badgeImages";
import { format } from "date-fns";

interface BadgeDetailsDialogProps {
  badge: Badge;
  earnedBadge?: UserBadge;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BadgeDetailsDialog = ({
  badge,
  earnedBadge,
  open,
  onOpenChange,
}: BadgeDetailsDialogProps) => {
  const imagePath = getBadgeImagePath(badge);

  const earnedDateLabel =
    earnedBadge && earnedBadge.earned_at
      ? format(new Date(earnedBadge.earned_at), "PPP")
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {badge.title}
          </DialogTitle>
          {earnedDateLabel && (
            <DialogDescription className="font-sans">
              Unlocked on {earnedDateLabel}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="mt-4 flex flex-col items-center gap-4">
          {imagePath && (
            <img
              src={imagePath}
              alt={badge.title}
              className="h-40 w-40 object-contain drop-shadow-lg"
            />
          )}
          {badge.description && (
            <p className="font-sans text-sm text-muted-foreground text-center max-w-xs">
              {badge.description}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

