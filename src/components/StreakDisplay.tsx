import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Award, Shield } from "lucide-react";
import type { StreakData } from "@/utils/streakCalculation";
import { getStreakMilestones } from "@/utils/streakCalculation";

interface StreakDisplayProps {
  streakData: StreakData;
  onUseFreeze?: () => void;
}

export const StreakDisplay = ({ streakData, onUseFreeze }: StreakDisplayProps) => {
  const milestones = getStreakMilestones(streakData.currentStreak);
  const isStreakActive = streakData.currentStreak > 0;

  return (
    <Card className="bg-gradient-card border-0 shadow-soft">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Current Streak */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Flame className={`h-8 w-8 ${isStreakActive ? 'text-orange-500' : 'text-muted'}`} />
              <div className="text-4xl font-bold">{streakData.currentStreak}</div>
            </div>
            <p className="text-sm text-muted-foreground">
              {isStreakActive ? 'Day Reading Streak!' : 'Start a streak today'}
            </p>
            
            {milestones.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1 justify-center">
                {milestones.map((milestone, i) => (
                  <span 
                    key={i}
                    className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium"
                  >
                    {milestone}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Award className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold">{streakData.longestStreak}</span>
              </div>
              <p className="text-xs text-muted-foreground">Longest Streak</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-2xl font-bold">
                  {streakData.freezeAvailable ? '1' : '0'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Freeze Available</p>
            </div>
          </div>

          {/* Streak Freeze Button */}
          {streakData.canUseFreezeToday && onUseFreeze && (
            <div className="pt-4 border-t">
              <Button
                onClick={onUseFreeze}
                disabled={!streakData.freezeAvailable}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <Shield className="mr-2 h-4 w-4" />
                Use Streak Freeze Today
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                {streakData.freezeAvailable
                  ? 'Preserve your streak without reading today'
                  : 'Freeze available again in 7 days'}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
