import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Medal1st, NavArrowRight } from "iconoir-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AppIcon } from "@/components/ui/app-icon";
import {
  BRACK_STREAK_HAPPY_IMAGE,
  BRACK_STREAK_SAD_IMAGE,
} from "@/config/brackAssets";
import { APP_ICONS } from "@/config/iconography";
import {
  getDashboardStreakPresentation,
  type DashboardStreakPresentation,
  type DashboardStreakState,
} from "@/lib/dashboardStreak";
import type {
  DashboardExperienceSource,
  DashboardStreakFreezeSummary,
  DashboardStreakSummary,
} from "@/services/api/dashboard";
import type { ReaderLeague } from "@/services/api/gamification";

export interface DashboardStreakCardProps {
  streak: DashboardStreakSummary;
  timezone: string;
  serverTime?: string | null;
  receivedAt?: string | null;
  source: DashboardExperienceSource | null;
  provisional: boolean;
  hasCurrentBook: boolean;
  showJourney: boolean;
  league: ReaderLeague | null;
  leagueCutoff: string | null;
  freeze: DashboardStreakFreezeSummary | null;
  canMutateFreeze: boolean;
  usingFreeze: boolean;
  onRead: () => void;
  onUseFreeze: () => void;
  onOpenShop: () => void;
  nowMs?: number;
}

interface StreakStateCopy {
  badge: string;
  title: string;
  description: string;
  imageAlt: string;
  readAction: string;
  happy: boolean;
}

const getStateCopy = (
  state: DashboardStreakState,
  streak: number,
): StreakStateCopy => {
  if (state === "on_track") {
    return {
      badge: "Secure today",
      title: "Your flame is bright",
      description: streak === 1
        ? "Your first streak day is logged. Return tomorrow to keep it growing."
        : `Day ${streak} is logged. Return tomorrow to make it ${streak + 1}.`,
      imageAlt: "Happy Brack flame; today's reading streak is secure",
      readAction: "Read a little more",
      happy: true,
    };
  }

  if (state === "protected") {
    return {
      badge: "Protected today",
      title: "Your streak is protected",
      description: "A Streak Freeze filled today's gap. Read tomorrow to keep the flame moving forward.",
      imageAlt: "Happy Brack flame; a Streak Freeze is protecting today",
      readAction: "Read anyway",
      happy: true,
    };
  }

  if (state === "at_risk") {
    return {
      badge: "Needs a page today",
      title: "Your flame needs you",
      description: `Your ${streak}-day streak is still active. Read or log progress before today's streak window ends.`,
      imageAlt: "Sad Brack flame; today's reading streak needs attention",
      readAction: "Read now",
      happy: false,
    };
  }

  if (state === "lapsed") {
    return {
      badge: "Fresh chapter",
      title: "Light the flame again",
      description: "A reading day was missed, but your personal best is saved. One reading action starts a new streak.",
      imageAlt: "Sad Brack flame ready to begin a new reading streak",
      readAction: "Start a new streak",
      happy: false,
    };
  }

  return {
    badge: "Start today",
    title: "Light your reading flame",
    description: "Finish a timer session or log reading progress to earn your first streak day.",
    imageAlt: "Sad Brack flame waiting for the first reading streak day",
    readAction: "Start reading",
    happy: false,
  };
};

const formatDateKey = (dateKey: string | null) => {
  if (!dateKey) return "No reading yet";
  const parsed = Date.parse(`${dateKey.slice(0, 10)}T12:00:00.000Z`);
  if (!Number.isFinite(parsed)) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(parsed));
};

const StreakMetric = ({
  value,
  label,
  primary = false,
}: {
  value: string | number;
  label: string;
  primary?: boolean;
}) => (
  <div className="min-w-0 rounded-xl border border-border/60 bg-background/65 px-3 py-2.5">
    <div className={`truncate font-sans text-2xl font-bold tabular-nums ${primary ? "text-primary" : "text-foreground"}`}>
      {value}
    </div>
    <p className="truncate font-sans text-xs text-muted-foreground">{label}</p>
  </div>
);

const StreakMilestone = ({ presentation }: { presentation: DashboardStreakPresentation }) => (
  <div className="space-y-2" aria-label="Streak milestone progress">
    <div className="flex items-center justify-between gap-3 font-sans text-xs">
      <span className="font-medium text-foreground">
        {presentation.nextMilestone
          ? `Next flame milestone: ${presentation.nextMilestone} days`
          : "Every flame milestone unlocked"}
      </span>
      {presentation.nextMilestone && (
        <span className="shrink-0 text-muted-foreground">
          {presentation.daysToNextMilestone} {presentation.daysToNextMilestone === 1 ? "day" : "days"} away
        </span>
      )}
    </div>
    <Progress
      value={presentation.milestoneProgress}
      className="h-2"
      aria-label={presentation.nextMilestone
        ? `${presentation.currentStreak} of ${presentation.nextMilestone} days toward the next streak milestone`
        : "All streak milestones unlocked"}
    />
  </div>
);

export const DashboardStreakCard = ({
  streak,
  timezone,
  serverTime,
  receivedAt,
  source,
  provisional,
  hasCurrentBook,
  showJourney,
  league,
  leagueCutoff,
  freeze,
  canMutateFreeze,
  usingFreeze,
  onRead,
  onUseFreeze,
  onOpenShop,
  nowMs,
}: DashboardStreakCardProps) => {
  const [liveClock, setLiveClock] = useState(Date.now);

  useEffect(() => {
    if (nowMs !== undefined) return undefined;
    const timer = window.setInterval(() => setLiveClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [nowMs]);

  const clock = nowMs ?? liveClock;

  const presentation = useMemo(
    () => getDashboardStreakPresentation(streak, {
      timezone,
      serverTime,
      receivedAt,
      nowMs: clock,
    }),
    [clock, receivedAt, serverTime, streak, timezone],
  );
  const copy = getStateCopy(presentation.state, presentation.currentStreak);
  const imageSrc = copy.happy ? BRACK_STREAK_HAPPY_IMAGE : BRACK_STREAK_SAD_IMAGE;
  const inventoryIsKnown = Boolean(freeze);
  const freezeQuantity = freeze?.quantity ?? 0;
  const freezeCapacity = freeze?.max_inventory ?? 0;
  const readAction = hasCurrentBook ? copy.readAction : "Choose a book";

  return (
    <Card
      className="h-full overflow-hidden border-border/70"
      data-streak-state={presentation.state}
    >
      <CardContent className="p-0">
        <section
          className="relative overflow-hidden bg-gradient-to-br from-primary/[0.12] via-background to-background p-4 sm:p-5"
          aria-labelledby="dashboard-streak-title"
        >
          <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/[0.08] blur-3xl" />
          <div className="relative grid grid-cols-[minmax(0,1fr)_6.25rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-5">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge className="border-primary/25 bg-primary/[0.1] text-primary hover:bg-primary/[0.1]">
                  {copy.badge}
                </Badge>
                {source === "cached" && <Badge variant="outline">Saved status</Badge>}
                {provisional && <Badge variant="outline">Reading changes syncing</Badge>}
              </div>
              <h2 id="dashboard-streak-title" className="font-display text-xl font-bold sm:text-2xl">
                {copy.title}
              </h2>
              <p className="mt-1 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground">
                {copy.description}
              </p>
            </div>

            <div className="flex aspect-square w-full items-center justify-center rounded-2xl border border-primary/20 bg-background/70 p-1.5 shadow-sm">
              <img
                src={imageSrc}
                alt={copy.imageAlt}
                className="h-full w-full object-contain"
                decoding="async"
                draggable={false}
              />
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StreakMetric value={presentation.currentStreak} label="current streak" primary />
            <StreakMetric value={Math.max(streak.longestStreak, presentation.currentStreak)} label="personal best" />
            <div className="col-span-2 sm:col-span-1">
              <StreakMetric value={formatDateKey(streak.lastReadingDate)} label="last reading" />
            </div>
          </div>

          <div className="relative mt-4">
            <StreakMilestone presentation={presentation} />
          </div>

          <div className="relative mt-4 flex flex-wrap gap-2">
            <Button onClick={onRead} className="min-h-11">
              <AppIcon icon={APP_ICONS.dashboard.continueReading} variant="inline" />
              {readAction}
            </Button>

            {showJourney && presentation.canProtectToday && (
              !inventoryIsKnown ? (
                <Button variant="outline" className="min-h-11" disabled>
                  Freeze inventory unavailable
                </Button>
              ) : freezeQuantity > 0 ? (
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={!canMutateFreeze || usingFreeze}
                  onClick={onUseFreeze}
                >
                  <AppIcon icon={APP_ICONS.stats.useFreeze} variant="inline" />
                  {usingFreeze
                    ? "Protecting..."
                    : canMutateFreeze
                      ? "Use a Freeze"
                      : "Reconnect to use"}
                </Button>
              ) : (
                <Button variant="outline" className="min-h-11" onClick={onOpenShop}>
                  Get a Freeze
                </Button>
              )
            )}
          </div>

          {provisional && (
            <p className="relative mt-3 font-sans text-xs text-muted-foreground" role="status">
              Locally saved reading can change this state after synchronization finishes.
            </p>
          )}
        </section>

        {showJourney && (
          <section className="space-y-3 border-t border-border/60 p-4 sm:p-5" aria-labelledby="streak-protection-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id="streak-protection-title" className="flex items-center gap-2 font-display text-base font-semibold">
                  <AppIcon icon={APP_ICONS.stats.freezeStatus} variant="inline" className="text-primary" />
                  Streak protection
                </h3>
                <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
                  {inventoryIsKnown
                    ? `${freezeQuantity} of ${freezeCapacity} ${freezeQuantity === 1 ? "Freeze" : "Freezes"} stored. A Freeze is spent only after Brack confirms an eligible missed reading day.`
                    : "Freeze inventory could not be refreshed. Brack will never show an unknown balance as zero or spend it while offline."}
                </p>
              </div>
              {!presentation.canProtectToday && (
                <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={onOpenShop}>
                  {inventoryIsKnown ? "Manage Freezes" : "View shop"}
                </Button>
              )}
            </div>

            {presentation.canProtectToday && inventoryIsKnown && freezeQuantity > 0 && !canMutateFreeze && (
              <p className="font-sans text-xs text-muted-foreground">
                Your saved inventory remains visible. Reconnect before Brack can validate and consume a Freeze.
              </p>
            )}

            <details className="group rounded-xl border border-border/60 bg-muted/[0.25]">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 font-sans text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                How streaks and Freezes work
                <NavArrowRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
              </summary>
              <ul className="space-y-2 border-t border-border/60 px-4 py-3 font-sans text-xs leading-relaxed text-muted-foreground">
                <li>A completed timer session or a saved progress log counts toward your current reading day.</li>
                <li>Reading on consecutive streak days grows the flame; your personal best remains even after a gap.</li>
                <li>A Streak Freeze protects an eligible day without reading. It uses one stored Freeze and the server enforces its cooldown.</li>
                <li>Gold Leaves buy Freezes in the Journey Shop. Buying one stores it; it is never consumed automatically.</li>
              </ul>
            </details>

            <Link
              to="/achievements?tab=rankings"
              className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/[0.1] text-primary">
                  <Medal1st className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-sm font-semibold">
                    {league ? `${league.name} - Rank #${league.provisional_rank}` : "Weekly Reader League"}
                  </span>
                  <span className="block truncate font-sans text-xs text-muted-foreground">
                    {league
                      ? `${league.score.toLocaleString()} competitive Ink - ${league.member_count} readers`
                      : "Turn consistent reading into weekly competitive Ink"}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right font-sans text-xs text-muted-foreground">
                {leagueCutoff && Number.isFinite(Date.parse(leagueCutoff))
                  ? `Ends ${format(new Date(leagueCutoff), "MMM d")}`
                  : "View league"}
              </span>
            </Link>
          </section>
        )}
      </CardContent>
    </Card>
  );
};
