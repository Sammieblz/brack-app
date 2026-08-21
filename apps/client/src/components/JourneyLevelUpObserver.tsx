import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import {
  dashboardHomeQueryKey,
  recordDashboardFetchObservation,
} from "@/lib/dashboardQueries";
import {
  advanceJourneyLevelCursor,
  isJourneyLevelObserverRoute,
} from "@/lib/journeyLevelObserver";
import { getDashboardExperience } from "@/services/api/dashboard";

interface LevelUpState {
  level: number;
  title: string;
}

export const JourneyLevelUpObserver = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { gamificationEnabled } = useFeatureFlags();
  const observerEnabled = Boolean(user)
    && gamificationEnabled
    && isJourneyLevelObserverRoute(location.pathname);
  const readsCombinedDashboard = observerEnabled && location.pathname === "/dashboard";
  const { data: gamificationData } = useGamification(
    observerEnabled && !readsCombinedDashboard ? user?.id : undefined,
  );
  const dashboardQuery = useQuery({
    queryKey: dashboardHomeQueryKey(user?.id, true, 10),
    queryFn: async () => {
      try {
        const result = await getDashboardExperience(user!.id, {
          includeJourney: true,
          recentLimit: 10,
        });
        recordDashboardFetchObservation(user!.id, result.source);
        return result;
      } catch (queryError) {
        recordDashboardFetchObservation(user!.id, "error");
        throw queryError;
      }
    },
    enabled: observerEnabled && readsCombinedDashboard,
    staleTime: 60_000,
  });
  const account = readsCombinedDashboard
    ? dashboardQuery.data?.data.journey?.account
    : gamificationData?.account;
  const [levelUp, setLevelUp] = useState<LevelUpState | null>(null);

  useEffect(() => {
    if (!observerEnabled) {
      setLevelUp(null);
      return;
    }
    if (!user || !account) return;
    const current = account.current_level;
    const previous = advanceJourneyLevelCursor(user.id, current);
    if (previous !== null && previous > 0 && current > previous) {
      setLevelUp({ level: current, title: account.level_title });
    }
  }, [account, observerEnabled, user]);

  if (!observerEnabled || !levelUp) return null;

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
