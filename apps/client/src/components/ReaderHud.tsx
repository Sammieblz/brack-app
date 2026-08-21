import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { AppIcon } from "@/components/ui/app-icon";
import { Progress } from "@/components/ui/progress";
import { APP_ICONS } from "@/config/iconography";
import { cn } from "@/lib/utils";
import { getLevelProgressDetails } from "@/lib/dashboardGamification";
import { useRewardHudTarget } from "@/contexts/RewardFeedbackContext";
import type { GamificationAccount } from "@/services/api/gamification";
import type { DashboardJourneyFreshness as JourneyFreshness } from "@/services/api/dashboard";

export type { DashboardJourneyFreshness as JourneyFreshness } from "@/services/api/dashboard";

export interface ReaderHudFreeze {
  quantity: number;
  max_inventory: number;
}

export interface ReaderHudNavigationState {
  journeyTelemetrySource: "dashboard_hud";
}

interface ReaderHudProps {
  account?: GamificationAccount | null;
  currentStreak?: number;
  freeze?: ReaderHudFreeze | null;
  freshness?: JourneyFreshness;
  cachedAt?: string | null;
  provisional?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export const ReaderHud = ({
  account,
  currentStreak = 0,
  freeze,
  freshness = "live",
  cachedAt,
  provisional = false,
  loading = false,
  error,
  onRetry,
  className,
}: ReaderHudProps) => {
  const inkHud = useRewardHudTarget("ink", account?.lifetime_ink);
  const goldHud = useRewardHudTarget("goldLeaves", account?.gold_leaves);

  if (loading && !account) {
    return (
      <div
        className={cn("grid min-h-[70px] grid-cols-3 overflow-hidden rounded-xl border border-border/70 bg-card", className)}
        aria-label="Loading Reader Journey"
        aria-busy="true"
      >
        {[0, 1, 2].map((item) => (
          <div key={item} className="flex items-center gap-2 border-r border-border/60 p-2.5 last:border-r-0">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-2.5 w-10 animate-pulse rounded bg-muted" />
              <div className="h-3.5 w-14 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!account) {
    return (
      <div
        className={cn(
          "flex min-h-[58px] items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-2",
          className,
        )}
        role="status"
      >
        <div className="min-w-0">
          <p className="font-sans text-xs font-semibold">Reader Journey is unavailable</p>
          <p className="truncate font-sans text-[11px] text-muted-foreground">
            {error || "Your reading progress is safe. Try again when connected."}
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 shrink-0 rounded-md px-3 font-sans text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const level = getLevelProgressDetails(account);
  const hasKnownFreezeInventory = Boolean(freeze);
  const freezeAccessibleLabel = hasKnownFreezeInventory
    ? `${freeze.quantity} Streak ${freeze.quantity === 1 ? "Freeze" : "Freezes"} owned`
    : "Streak Freeze inventory unavailable";
  const isCached = freshness === "cached" || freshness === "expired";
  const hasValidCachedAt = Boolean(cachedAt && Number.isFinite(Date.parse(cachedAt)));
  const statusText = provisional
    ? "Sync pending"
    : isCached && hasValidCachedAt
      ? `Synced ${formatDistanceToNow(new Date(cachedAt), { addSuffix: true })}`
      : isCached
        ? "Offline snapshot"
        : null;
  const navigationState = {
    journeyTelemetrySource: "dashboard_hud",
  } satisfies ReaderHudNavigationState;

  return (
    <section
      aria-label="Reader progress"
      className={cn(
        "grid min-h-[70px] grid-cols-3 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm",
        className,
      )}
      style={{
        background: "linear-gradient(115deg, color-mix(in srgb, hsl(var(--primary)) 7%, hsl(var(--card))), hsl(var(--card)) 58%)",
      }}
    >
      <Link
        ref={inkHud.targetRef}
        to="/achievements?tab=overview"
        state={navigationState}
        data-reward-hud-target="ink"
        data-reward-pulsing={inkHud.isPulsing ? "true" : "false"}
        className={cn(
          "group min-w-0 border-r border-border/60 p-2.5 transition-colors hover:bg-primary/[0.07] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-[359px]:p-1.5",
          inkHud.isPulsing && "bg-primary/10 ring-2 ring-inset ring-primary/40",
        )}
        aria-label={`Level ${account.current_level}, ${account.level_title}. ${account.lifetime_ink.toLocaleString()} Lifetime Ink. ${level.isMaximumLevel ? "Maximum level" : `${level.inkToNextLevel} Ink to level ${account.next_level?.level}`}`}
      >
        <span className="flex min-w-0 items-center gap-2 max-[359px]:gap-1">
          <CurrencyIcon currency="ink" className="h-6 w-6 max-[359px]:h-[22px] max-[359px]:w-[22px]" />
          <span className="min-w-0">
            <span className="block truncate font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Level {account.current_level}
            </span>
            <span
              aria-hidden="true"
              className="block truncate font-display text-sm font-bold tabular-nums max-[359px]:text-xs"
              data-reward-hud-value="ink"
              title={`${account.lifetime_ink.toLocaleString()} Lifetime Ink`}
            >
              {inkHud.displayValue.toLocaleString()} Ink
            </span>
          </span>
        </span>
        <Progress
          value={level.percent}
          className="mt-1.5"
          aria-label={`Level progress ${Math.round(level.percent)} percent`}
        />
        <span className="mt-1 block truncate font-sans text-[10px] text-muted-foreground max-[359px]:hidden">
          <span>{account.level_title}</span>
          <span aria-hidden="true">{" \u00b7 "}</span>
          <span>
            {level.isMaximumLevel
              ? "Maximum level"
              : `${level.inkToNextLevel.toLocaleString()} Ink to Level ${account.next_level?.level}`}
          </span>
        </span>
      </Link>

      <Link
        to="/achievements?tab=quests"
        state={navigationState}
        className="group flex min-w-0 items-center gap-2 border-r border-border/60 p-2.5 transition-colors hover:bg-primary/[0.07] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-[359px]:gap-1 max-[359px]:p-1.5"
        aria-label={`${currentStreak} day reading streak. ${freezeAccessibleLabel}`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/[0.1] text-primary max-[359px]:h-[22px] max-[359px]:w-[22px]">
          <AppIcon icon={APP_ICONS.dashboard.streak} variant="inline" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Streak
          </span>
          <span className="block truncate font-display text-sm font-bold max-[359px]:text-xs">
            {currentStreak} {currentStreak === 1 ? "day" : "days"}
          </span>
          <span className="flex items-center gap-1 truncate font-sans text-[10px] text-muted-foreground max-[359px]:hidden">
            <AppIcon icon={APP_ICONS.stats.freezeStatus} variant="inline" size="xs" />
            {hasKnownFreezeInventory
              ? `${freeze.quantity} protected`
              : "Inventory unavailable"}
          </span>
        </span>
      </Link>

      <Link
        ref={goldHud.targetRef}
        to="/achievements?tab=shop"
        state={navigationState}
        data-reward-hud-target="goldLeaves"
        data-reward-pulsing={goldHud.isPulsing ? "true" : "false"}
        className={cn(
          "group flex min-w-0 items-center gap-2 p-2.5 transition-colors hover:bg-primary/[0.07] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-[359px]:gap-1 max-[359px]:p-1.5",
          goldHud.isPulsing && "bg-primary/10 ring-2 ring-inset ring-primary/40",
        )}
        aria-label={`${account.gold_leaves.toLocaleString()} Gold Leaves. Open Journey Shop`}
      >
        <CurrencyIcon currency="goldLeaves" className="h-6 w-6 max-[359px]:h-[22px] max-[359px]:w-[22px]" />
        <span className="min-w-0">
          <span className="block truncate font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Wallet
          </span>
          <span
            aria-hidden="true"
            className="block truncate font-display text-sm font-bold tabular-nums max-[359px]:text-xs"
            data-reward-hud-value="goldLeaves"
            title={account.gold_leaves.toLocaleString()}
          >
            {goldHud.displayValue.toLocaleString()}
          </span>
          <span className="block truncate font-sans text-[10px] text-muted-foreground max-[359px]:hidden">Gold Leaves</span>
        </span>
      </Link>

      {statusText && (
        <span
          className="pointer-events-none col-span-3 block min-h-4 truncate border-t border-border/50 bg-background/45 px-2 py-0.5 text-right font-sans text-[9px] font-medium leading-3 text-muted-foreground"
          role="status"
        >
          {statusText}
        </span>
      )}
    </section>
  );
};
