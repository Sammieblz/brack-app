import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Clock } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { cn } from "@/lib/utils";
import {
  formatQuestCountdown,
  formatQuestValue,
  getQuestAction,
  getQuestActionLabel,
  getQuestRemainingMs,
  type DailyFocusAction,
} from "@/lib/dashboardGamification";
import { questProgressPercent } from "@/lib/gamification";
import type { QuestAssignment } from "@/services/api/gamification";
import type { JourneyFreshness } from "@/components/ReaderHud";

interface DailyFocusCardProps {
  quest: QuestAssignment | null;
  serverTime?: string | null;
  timezone?: string;
  receivedAt?: string | null;
  freshness?: JourneyFreshness;
  provisional?: boolean;
  hasCurrentBook?: boolean;
  onAction: (action: DailyFocusAction, quest: QuestAssignment) => void;
  className?: string;
}

export const DailyFocusCard = ({
  quest,
  serverTime,
  timezone = "UTC",
  receivedAt,
  freshness = "live",
  provisional = false,
  hasCurrentBook = false,
  onAction,
  className,
}: DailyFocusCardProps) => {
  const receivedAtRef = useRef(
    receivedAt && Number.isFinite(Date.parse(receivedAt))
      ? Date.parse(receivedAt)
      : Date.now(),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    receivedAtRef.current = receivedAt && Number.isFinite(Date.parse(receivedAt))
      ? Date.parse(receivedAt)
      : Date.now();
    setNow(Date.now());
  }, [receivedAt, serverTime]);

  useEffect(() => {
    if (!quest || quest.status !== "active") return;
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, [quest]);

  if (!quest) {
    return (
      <section
        className={cn("rounded-xl border border-border/70 bg-card p-5", className)}
        aria-labelledby="daily-focus-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-primary">Daily Focus</p>
            <h2 id="daily-focus-title" className="mt-1 font-display text-xl font-bold">Choose your next chapter</h2>
            <p className="mt-1 font-serif text-sm text-muted-foreground">
              Your next quest will appear here. Reading progress still counts toward your Journey.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/my-books">Open library</Link>
          </Button>
        </div>
      </section>
    );
  }

  const progress = questProgressPercent(quest.progress_value, quest.target_value);
  const isComplete = quest.status === "completed";
  const isExpiredSnapshot = freshness === "expired";
  const remainingMs = getQuestRemainingMs(
    quest.period_end,
    serverTime,
    receivedAtRef.current,
    now,
    timezone,
  );
  const action = getQuestAction(quest.metric);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-primary/25 bg-card shadow-sm",
        className,
      )}
      style={{
        background: "linear-gradient(135deg, color-mix(in srgb, hsl(var(--primary)) 10%, hsl(var(--card))), hsl(var(--card)) 58%)",
      }}
      aria-labelledby={`daily-focus-${quest.id}`}
    >
      <div
        className="grid items-center gap-5 p-5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))" }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Daily Focus
            </p>
            {quest.cadence === "weekly" && <Badge variant="secondary">Weekly focus</Badge>}
            {isComplete && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Earned
              </Badge>
            )}
            {provisional && <Badge variant="outline">Progress syncing</Badge>}
          </div>

          <h2 id={`daily-focus-${quest.id}`} className="mt-2 font-display text-xl font-bold sm:text-2xl">
            {quest.title}
          </h2>
          <p className="mt-1 max-w-2xl font-serif text-sm text-muted-foreground">
            {quest.description}
          </p>

          <div className="mt-4">
            <div className="mb-1.5 flex items-end justify-between gap-3 font-sans text-xs">
              <span className="font-semibold text-foreground">
                {formatQuestValue(quest.metric, quest.progress_value)}
                <span className="font-normal text-muted-foreground"> of {formatQuestValue(quest.metric, quest.target_value)}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">{Math.round(progress)}%</span>
            </div>
            <Progress
              value={Math.min(quest.progress_value, quest.target_value)}
              max={quest.target_value}
              variant="dimensional"
              aria-label={`${quest.title} progress`}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-sans text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {isComplete ? "Completed" : formatQuestCountdown(remainingMs)}
            </span>
            <span className="inline-flex items-center gap-1.5" aria-label={`${quest.reward_ink} Ink reward`}>
              <CurrencyIcon currency="ink" className="h-[22px] w-[22px]" />
              <strong className="text-foreground">+{quest.reward_ink.toLocaleString()}</strong> Ink
            </span>
            {quest.reward_gold_leaves > 0 && (
              <span className="inline-flex items-center gap-1.5" aria-label={`${quest.reward_gold_leaves} Gold Leaves reward`}>
                <CurrencyIcon currency="goldLeaves" className="h-[22px] w-[22px]" />
                <strong className="text-foreground">+{quest.reward_gold_leaves.toLocaleString()}</strong> Gold Leaves
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-row flex-wrap items-center gap-2">
          {!isComplete && (
            <Button
              type="button"
              onClick={() => onAction(action, quest)}
              disabled={isExpiredSnapshot}
              className="flex-1"
            >
              {isExpiredSnapshot ? "Reconnect to start" : getQuestActionLabel(quest.metric, hasCurrentBook)}
            </Button>
          )}
          <Button asChild variant="outline" className="flex-1">
            <Link to="/achievements?tab=quests">All quests</Link>
          </Button>
          <p className="w-full text-center font-sans text-[10px] text-muted-foreground">
            Rewards are added automatically.
          </p>
        </div>
      </div>
    </section>
  );
};
