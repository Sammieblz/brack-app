import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Shield } from "iconoir-react";
import type { StreakData } from "@/utils/streakCalculation";
import { getStreakMilestones } from "@/utils/streakCalculation";
import { Confetti } from "@/components/animations/Confetti";
import { useGSAP } from "@/hooks/useGSAP";
import { countUp } from "@/lib/animations/gsap-presets";
import { BRACK_STREAK_HAPPY_IMAGE, BRACK_STREAK_SAD_IMAGE } from "@/config/brackAssets";

interface StreakDisplayProps {
  streakData: StreakData;
  onUseFreeze?: () => void;
}

const milestoneTargets = [3, 7, 14, 30, 60, 100, 365];

const formatLastRead = (date: string | null) => {
  if (!date) return "No sessions yet";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export const StreakDisplay = ({ streakData, onUseFreeze }: StreakDisplayProps) => {
  const milestones = getStreakMilestones(streakData.currentStreak);
  const isStreakActive = streakData.currentStreak > 0;
  const isFollowingStreak = streakData.hasReadingToday;
  const streakImageSrc = isFollowingStreak
    ? BRACK_STREAK_HAPPY_IMAGE
    : BRACK_STREAK_SAD_IMAGE;
  const streakImageAlt = isFollowingStreak
    ? "Brack streak mascot happy"
    : "Brack streak mascot sad";
  const statusLabel = isFollowingStreak
    ? "On track today"
    : streakData.usedFreezeToday
    ? "Protected today"
    : streakData.canUseFreezeToday
    ? "Slacking today"
    : "Start today";
  const statusMessage = isFollowingStreak
    ? "Keep your momentum going"
    : streakData.usedFreezeToday
    ? "Freeze used; read tomorrow to keep the streak alive"
    : streakData.canUseFreezeToday
    ? "Read today or use a freeze to protect it"
    : "Log reading today to begin";
  const nextMilestone = milestoneTargets.find((target) => target > streakData.currentStreak) ?? null;
  const milestoneProgress = nextMilestone
    ? Math.min(100, Math.round((streakData.currentStreak / nextMilestone) * 100))
    : 100;
  const daysToNextMilestone = nextMilestone ? nextMilestone - streakData.currentStreak : 0;
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
      <Card className="self-start overflow-hidden">
        <CardContent className="p-4 md:p-5">
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-primary/10 ring-1 ring-primary/15">
                    <img
                      src={streakImageSrc}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-contain p-1"
                    />
                  </div>
                  <h3 className="font-display text-base font-semibold md:text-lg">Reading Streak</h3>
                </div>
                <p className="font-sans text-sm text-muted-foreground">
                  {statusMessage}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 sm:justify-end">
                <div className="w-fit whitespace-nowrap rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
                  Last read: {formatLastRead(streakData.lastReadingDate)}
                </div>
                <div className="w-fit whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {statusLabel}
                </div>
              </div>
            </div>

            <div className="grid gap-4 rounded-md border border-border/70 bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-center">
              <div>
                <div className="flex items-baseline gap-2">
                  <div ref={streakNumberRef} className="font-sans text-5xl font-bold leading-none text-foreground">
                    {displayedStreak}
                  </div>
                  <span className="font-sans text-sm font-medium text-muted-foreground">
                    {displayedStreak === 1 ? "day" : "days"}
                  </span>
                </div>
                <p className="mt-2 font-sans text-sm text-muted-foreground">
                  {isStreakActive ? "Current reading streak" : "Current streak"}
                </p>
              </div>

              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-md bg-background/70 ring-1 ring-border/70 sm:mx-0 sm:h-28 sm:w-28">
                <img
                  src={streakImageSrc}
                  alt={streakImageAlt}
                  className="h-full w-full object-contain p-2"
                  loading="lazy"
                  draggable={false}
                />
              </div>
            </div>
            
            {milestones.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {milestones.map((milestone, i) => (
                  <span 
                    key={i}
                    className="font-sans rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {milestone}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-sans text-sm font-medium">
                  {nextMilestone ? `Next milestone: ${nextMilestone} days` : "All milestones unlocked"}
                </span>
                {nextMilestone && (
                  <span className="font-sans text-xs text-muted-foreground">
                    {daysToNextMilestone} {daysToNextMilestone === 1 ? "day" : "days"} left
                  </span>
                )}
              </div>
              <Progress value={milestoneProgress} className="h-2" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border/70 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="font-sans text-lg font-bold">{streakData.longestStreak}</span>
                </div>
                <p className="font-sans text-xs text-muted-foreground">Longest streak</p>
              </div>

              <div className="rounded-md border border-border/70 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="font-sans text-lg font-bold">
                    {streakData.freezeAvailable ? "Ready" : "Used"}
                  </span>
                </div>
                <p className="font-sans text-xs text-muted-foreground">Streak freeze</p>
              </div>
            </div>

            {streakData.canUseFreezeToday && onUseFreeze && (
              <div className="rounded-md border border-border/70 bg-background/60 p-3">
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
                <p className="font-sans mt-2 text-center text-xs text-muted-foreground">
                  {streakData.freezeAvailable
                    ? "Preserve your streak without reading today"
                    : "Freeze available again in 7 days"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
};
