import { Card, CardContent } from "@/components/ui/card";
import type { Badge, UserBadge } from "@/types";
import { getBadgeImagePath } from "@/lib/badgeImages";

interface BadgeDisplayProps {
  badges: Badge[];
  earnedBadges: UserBadge[];
  onBadgeClick?: (badge: Badge, earnedBadge?: UserBadge) => void;
}

export const BadgeDisplay = ({ badges, earnedBadges, onBadgeClick }: BadgeDisplayProps) => {
  const earnedBadgeById = new Map(earnedBadges.map((eb) => [eb.badge_id, eb]));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {badges.map((badge) => {
        const earnedBadge = earnedBadgeById.get(badge.id);
        const isEarned = Boolean(earnedBadge);
        const imagePath = getBadgeImagePath(badge);

        const handleClick = () => {
          if (!isEarned || !onBadgeClick) return;
          onBadgeClick(badge, earnedBadge);
        };
        
        return (
          <Card 
            key={badge.id} 
            onClick={handleClick}
            className={`${isEarned ? 'bg-gradient-card cursor-pointer' : 'bg-muted/30'} transition-all hover:shadow-soft`}
          >
            <CardContent className="p-4 text-center space-y-2">
              {imagePath && (
                <div className={`flex justify-center ${!isEarned ? 'opacity-40 grayscale' : ''}`}>
                  <img
                    src={imagePath}
                    alt={badge.title}
                    className="h-20 w-20 object-contain"
                    loading="lazy"
                  />
                </div>
              )}
              <h3 className={`font-sans font-semibold text-sm ${!isEarned && 'text-muted-foreground'}`}>
                {badge.title}
              </h3>
              <p className="font-sans text-xs text-muted-foreground line-clamp-2">
                {badge.description}
              </p>
              {isEarned && (
                <div className="font-sans text-xs text-primary font-medium">
                  ✓ Earned
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
