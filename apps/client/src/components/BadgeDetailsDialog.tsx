import type { Badge, UserBadge } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge as BadgeChip } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BadgeEmblem } from "@/components/BadgeEmblem";
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
          <BadgeEmblem badge={badge} earned={Boolean(earnedBadge)} size="lg" />
          <div className="flex items-center gap-2">
            <BadgeChip variant="outline" className="capitalize">
              {badge.category}
            </BadgeChip>
            <BadgeChip variant="outline" className="capitalize">
              {badge.rarity}
            </BadgeChip>
            <BadgeChip variant="secondary">Tier {badge.tier}</BadgeChip>
          </div>
          {badge.description && (
            <p className="font-sans text-sm text-muted-foreground text-center max-w-xs">
              {badge.description}
            </p>
          )}
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{earnedBadge ? "Completed" : "Progress"}</span>
              <span className="text-muted-foreground">
                {Math.min(badge.progress_value || 0, badge.target_value).toLocaleString()}
                /{badge.target_value.toLocaleString()}
              </span>
            </div>
            <Progress
              value={earnedBadge ? 100 : badge.progress_percentage || 0}
              className="h-2"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

