import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, Calendar, Flame } from "lucide-react";
import { useStreakHistory } from "@/hooks/useStreakHistory";
import { formatDistanceToNow } from "date-fns";
import LoadingSpinner from "./LoadingSpinner";

interface StreakHistoryTimelineProps {
  userId: string;
}

export const StreakHistoryTimeline = ({ userId }: StreakHistoryTimelineProps) => {
  const { milestones, loading, getMilestoneBadges, longestStreakMilestone } = useStreakHistory(userId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center">
            <Trophy className="h-5 w-5 mr-2" />
            Streak Milestones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const milestoneBadges = getMilestoneBadges();
  const achievedMilestones = milestoneBadges.filter((m) => m.achieved);

  if (milestones.length === 0 && achievedMilestones.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center">
            <Trophy className="h-5 w-5 mr-2" />
            Streak Milestones
          </CardTitle>
          <CardDescription className="font-sans">Track your reading streak achievements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Flame className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="font-sans text-sm text-muted-foreground">
              Start a reading streak to unlock milestones!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display flex items-center">
          <Trophy className="h-5 w-5 mr-2" />
          Streak Milestones
        </CardTitle>
        <CardDescription className="font-sans">
          {longestStreakMilestone && (
            <span>
              Longest streak: <strong>{longestStreakMilestone.streak_count} days</strong>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Milestone Badges */}
          <div>
            <h4 className="font-display text-sm font-semibold mb-3">Milestone Achievements</h4>
            <div className="grid grid-cols-3 gap-2">
              {milestoneBadges.map((badge) => (
                <div
                  key={badge.threshold}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    badge.achieved
                      ? "bg-primary/10 border-primary/20"
                      : "bg-muted/30 border-muted opacity-50"
                  }`}
                >
                  <div className="font-sans text-2xl font-bold">{badge.threshold}</div>
                  <div className="font-sans text-xs text-muted-foreground mt-1">days</div>
                  {badge.achieved && (
                    <Trophy className="h-4 w-4 mx-auto mt-1 text-primary" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline of Achievements */}
          {milestones.length > 0 && (
            <div>
              <h4 className="font-display text-sm font-semibold mb-3">Achievement History</h4>
              <div className="space-y-3">
                {milestones.slice(0, 5).map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Flame className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-sans flex items-center gap-2">
                        <span className="font-semibold">{milestone.streak_count} days</span>
                        <span className="text-xs text-muted-foreground">streak achieved</span>
                      </div>
                      <div className="font-sans flex items-center gap-2 mt-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(milestone.achieved_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {milestones.length > 5 && (
                <p className="font-sans text-xs text-muted-foreground text-center mt-3">
                  +{milestones.length - 5} more milestone{milestones.length - 5 > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
