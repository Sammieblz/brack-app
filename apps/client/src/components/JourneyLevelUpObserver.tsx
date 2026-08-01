import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Confetti } from "@/components/animations/Confetti";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useGamification } from "@/hooks/useGamification";

interface LevelUpState {
  level: number;
  title: string;
}

export const JourneyLevelUpObserver = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { gamificationEnabled } = useFeatureFlags();
  const { data } = useGamification(gamificationEnabled ? user?.id : undefined);
  const [levelUp, setLevelUp] = useState<LevelUpState | null>(null);

  useEffect(() => {
    if (!user || !data) return;
    const key = `brack:journey-level:${user.id}`;
    const previous = Number(localStorage.getItem(key) || 0);
    const current = data.account.current_level;
    localStorage.setItem(key, String(current));
    if (previous > 0 && current > previous) {
      setLevelUp({ level: current, title: data.account.level_title });
    }
  }, [data, user]);

  if (!levelUp) return null;

  return (
    <>
      <Confetti trigger />
      <Dialog open onOpenChange={(open) => !open && setLevelUp(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Reader level up</DialogTitle>
            <DialogDescription>
              Your reading earned a new place in the Brack Journey.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-4">
            <p className="text-sm text-muted-foreground">Level {levelUp.level}</p>
            <p className="font-display text-3xl font-bold text-primary">{levelUp.title}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setLevelUp(null)}>
              Continue
            </Button>
            <Button
              onClick={() => {
                setLevelUp(null);
                navigate("/achievements");
              }}
            >
              View Journey
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
