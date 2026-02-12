import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Award, Shield } from "lucide-react";
import type { StreakData } from "@/utils/streakCalculation";
import { getStreakMilestones } from "@/utils/streakCalculation";
import { StreakFlame } from "@/components/animations/StreakFlame";
import { Confetti } from "@/components/animations/Confetti";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { countUp } from "@/lib/animations/gsap-presets";

interface StreakDisplayProps {
  streakData: StreakData;
  onUseFreeze?: () => void;
}

export const StreakDisplay = ({ streakData, onUseFreeze }: StreakDisplayProps) => {
  const milestones = getStreakMilestones(streakData.currentStreak);
  const isStreakActive = streakData.currentStreak > 0;
  const [showConfetti, setShowConfetti] = useState(false);
  const [displayedStreak, setDisplayedStreak] = useState(0);
  const streakNumberRef = useRef<HTMLDivElement>(null);
  const prevStreakRef = useRef(streakData.currentStreak);

  // Trigger confetti on milestone
  useEffect(() => {
    if (streakData.currentStreak > prevStreakRef.current && streakData.currentStreak > 0) {
      const milestoneStreaks = [7, 14, 30, 50, 100, 365];
      if (milestoneStreaks.includes(streakData.currentStreak)) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    }
    prevStreakRef.current = streakData.currentStreak;
  }, [streakData.currentStreak]);

  // Count up animation
  useGSAP(() => {
    if (streakNumberRef.current && isStreakActive) {
      countUp(streakNumberRef.current, 0, streakData.currentStreak, {
        duration: 1,
        onUpdate: (value) => setDisplayedStreak(Math.round(value)),
      });
    } else {
      setDisplayedStreak(streakData.currentStreak);
    }
  }, { dependencies: [streakData.currentStreak, isStreakActive] });

  return (
    <>
      {showConfetti && <Confetti trigger={showConfetti} />}
      <Card className="bg-gradient-card border-0 shadow-soft">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Current Streak */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {isStreakActive ? (
                  <StreakFlame active={isStreakActive} intensity={1} className="h-8 w-8" />
                ) : (
                  <Flame className="h-8 w-8 text-muted" />
                )}
                <div ref={streakNumberRef} className="text-4xl font-bold">
                  {displayedStreak}
                </div>
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
    </>
  );
};
