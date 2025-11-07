import { Card, CardContent } from "@/components/ui/card";
import type { Badge, UserBadge } from "@/types";

interface BadgeDisplayProps {
  badges: Badge[];
  earnedBadges: UserBadge[];
}

export const BadgeDisplay = ({ badges, earnedBadges }: BadgeDisplayProps) => {
  const earnedBadgeIds = new Set(earnedBadges.map(eb => eb.badge_id));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {badges.map((badge) => {
        const isEarned = earnedBadgeIds.has(badge.id);
        
        return (
          <Card 
            key={badge.id} 
            className={`${isEarned ? 'bg-gradient-card' : 'bg-muted/30'} transition-all hover:shadow-soft`}
          >
            <CardContent className="p-4 text-center space-y-2">
              <div className={`text-4xl ${!isEarned && 'opacity-30 grayscale'}`}>
                {badge.icon_url}
              </div>
              <h3 className={`font-semibold text-sm ${!isEarned && 'text-muted-foreground'}`}>
                {badge.title}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {badge.description}
              </p>
              {isEarned && (
                <div className="text-xs text-primary font-medium">
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
