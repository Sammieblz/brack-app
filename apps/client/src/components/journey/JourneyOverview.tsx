import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppIcon } from "@/components/ui/app-icon";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { JourneyQuestCard } from "@/components/journey/JourneyQuests";
import {
  JourneyInlineEmpty,
  JourneySectionEyebrow,
  JourneySurface,
} from "@/components/journey/JourneySurface";
import { useJourneyCountdown } from "@/components/journey/useJourneyCountdown";
import { APP_ICONS } from "@/config/iconography";
import { getLevelProgressDetails, type JourneyTabValue } from "@/lib/journey";
import type {
  GamificationHomeResponse,
  InkLedgerEntry,
  QuestAssignment,
  ReaderLeague,
} from "@/services/api/gamification";

interface JourneyOverviewProps {
  data: GamificationHomeResponse;
  dailyFocus: QuestAssignment | null;
  provisional: boolean;
  leaderboardsEnabled: boolean;
  savingOptIn: boolean;
  actionLoading: boolean;
  currentCycleAvailable: boolean;
  onQuestAction: (quest: QuestAssignment) => void;
  onJoinLeague: () => void;
  onOpenTab: (tab: JourneyTabValue) => void;
}

export const JourneyOverview = ({
  data,
  dailyFocus,
  provisional,
  leaderboardsEnabled,
  savingOptIn,
  actionLoading,
  currentCycleAvailable,
  onQuestAction,
  onJoinLeague,
  onOpenTab,
}: JourneyOverviewProps) => (
  <div className="space-y-5">
    <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
      <LevelHero data={data} provisional={provisional} />
      <JourneyWallet
        balance={data.account.gold_leaves}
        onOpenShop={() => onOpenTab("shop")}
      />
    </section>

    <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
      <JourneySurface variant="hero" className="p-5 sm:p-6">
        <JourneySectionEyebrow>Today&apos;s focus</JourneySectionEyebrow>
        {dailyFocus ? (
          <JourneyQuestCard
            quest={dailyFocus}
            serverTime={data.server_time}
            timezone={data.timezone}
            receivedAt={data.cached_at}
            featured
            onAction={onQuestAction}
            actionLoading={actionLoading}
          />
        ) : (
          <JourneyInlineEmpty
            title="Today is yours"
            description="New daily quests will appear here when the next cycle begins."
          />
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 min-h-11 px-0 text-primary hover:bg-transparent"
          onClick={() => onOpenTab("quests")}
        >
          View all quests
          <AppIcon icon={APP_ICONS.common.forward} variant="inline" size="sm" className="ml-1" />
        </Button>
      </JourneySurface>

      <LeagueSummary
        league={data.league}
        enabled={leaderboardsEnabled}
        unavailable={!currentCycleAvailable}
        savingOptIn={savingOptIn}
        onOpen={() => onOpenTab("rankings")}
        onJoin={onJoinLeague}
        cutoff={data.week.scoring_closes_at}
        serverTime={data.server_time}
        timezone={data.timezone}
        receivedAt={data.cached_at}
      />

      <LatestReward
        reward={data.recent_rewards.find((reward) =>
          reward.ink_delta > 0 || reward.gold_leaves_delta > 0)}
      />
    </section>
  </div>
);

const LevelHero = ({
  data,
  provisional,
}: {
  data: GamificationHomeResponse;
  provisional: boolean;
}) => {
  const level = getLevelProgressDetails(data.account);

  return (
    <JourneySurface variant="hero" className="overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <JourneySectionEyebrow>Level {data.account.current_level}</JourneySectionEyebrow>
          <h2 className="break-words font-display text-3xl font-bold sm:text-4xl">{data.account.level_title}</h2>
          <p
            className="mt-2 flex min-w-0 max-w-full items-center gap-2 text-sm text-muted-foreground"
            aria-label={`${data.account.lifetime_ink.toLocaleString()} Lifetime Ink`}
          >
            <CurrencyIcon currency="ink" size="lg" />
            <strong
              className="min-w-0 truncate text-base text-foreground"
              title={data.account.lifetime_ink.toLocaleString()}
            >
              {data.account.lifetime_ink.toLocaleString()}
            </strong>
            <span className="shrink-0">Lifetime Ink</span>
          </p>
        </div>
        {provisional && <Badge variant="secondary">Progress syncing</Badge>}
      </div>

      <div className="mt-7 space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2 text-sm">
          <span className="font-medium">
            {level.isMaximumLevel
              ? "Maximum level reached"
              : `${level.currentInk.toLocaleString()} of ${level.span.toLocaleString()} Ink`}
          </span>
          <span className="text-muted-foreground">
            {level.isMaximumLevel
              ? "Every page still adds to your legacy"
              : `${level.remaining.toLocaleString()} Ink to Level ${data.account.next_level?.level}`}
          </span>
        </div>
        <Progress
          value={level.percentage}
          className="h-3"
          aria-label={level.isMaximumLevel
            ? "Maximum reader level reached"
            : `${Math.round(level.percentage)}% toward level ${data.account.next_level?.level}`}
        />
        {!level.isMaximumLevel && data.account.next_level && (
          <p className="text-xs text-muted-foreground">Next title: {data.account.next_level.title}</p>
        )}
      </div>
    </JourneySurface>
  );
};

const JourneyWallet = ({ balance, onOpenShop }: { balance: number; onOpenShop: () => void }) => (
  <JourneySurface variant="interactive" className="overflow-hidden">
    <button
      type="button"
      onClick={onOpenShop}
      className="flex h-full min-h-52 min-w-0 w-full items-center gap-3 overflow-hidden p-4 text-left focus-visible:outline-none sm:gap-5 sm:p-6"
      aria-label={`${balance.toLocaleString()} Gold Leaves. Open shop`}
    >
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-primary/[0.16] bg-primary/[0.06] sm:h-20 sm:w-20">
        <CurrencyIcon currency="goldLeaves" size="xl" className="h-12 w-12 sm:h-14 sm:w-14" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Spendable currency
        </span>
        <strong
          className="block truncate text-2xl font-bold tabular-nums sm:text-3xl"
          title={balance.toLocaleString()}
        >
          {balance.toLocaleString()}
        </strong>
        <span className="mt-1 block text-sm text-muted-foreground">
          Gold {balance === 1 ? "Leaf" : "Leaves"} · Open shop
        </span>
      </span>
      <AppIcon icon={APP_ICONS.common.forward} variant="action" className="shrink-0" />
    </button>
  </JourneySurface>
);

const LeagueSummary = ({
  league,
  enabled,
  unavailable,
  savingOptIn,
  onOpen,
  onJoin,
  cutoff,
  serverTime,
  timezone,
  receivedAt,
}: {
  league: ReaderLeague | null;
  enabled: boolean;
  unavailable: boolean;
  savingOptIn: boolean;
  onOpen: () => void;
  onJoin: () => void;
  cutoff: string;
  serverTime: string;
  timezone: string;
  receivedAt?: string | null;
}) => {
  const countdown = useJourneyCountdown(cutoff, serverTime, timezone, receivedAt);

  return (
    <JourneySurface variant={enabled && league ? "interactive" : "flat"} className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <JourneySectionEyebrow>This week</JourneySectionEyebrow>
          <h3 className="font-display text-xl font-bold">Reader League</h3>
        </div>
        <AppIcon icon={APP_ICONS.journey.rankings} variant="status" size="lg" />
      </div>
      {unavailable ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Refresh Journey to see the current weekly standings.
        </p>
      ) : !enabled ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Leagues are paused. Your quests and level continue normally.
        </p>
      ) : league ? (
        <>
          <button
            type="button"
            onClick={onOpen}
            className="mt-4 w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="block font-medium">{league.name} · Tier {league.tier}</span>
            <span className="mt-2 flex items-end justify-between gap-3">
              <span>
                <strong className="block text-3xl">#{league.provisional_rank}</strong>
                <span className="text-xs text-muted-foreground">of {league.member_count} readers</span>
              </span>
              <span className="text-right text-sm">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <CurrencyIcon currency="ink" size="md" />
                  {league.score.toLocaleString()}
                </span>
                <span className="block text-xs text-muted-foreground">competitive Ink</span>
              </span>
            </span>
          </button>
          <p className="mt-4 text-xs text-muted-foreground">{countdown}</p>
        </>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Join an optional weekly group. Your lifetime Ink never depends on ranking.
          </p>
          <Button size="sm" className="min-h-11" onClick={onJoin} disabled={savingOptIn}>Join next week</Button>
        </div>
      )}
    </JourneySurface>
  );
};

const LatestReward = ({ reward }: { reward: InkLedgerEntry | undefined }) => (
  <JourneySurface variant="flat" className="p-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <JourneySectionEyebrow>Latest reward</JourneySectionEyebrow>
        <h3 className="font-display text-xl font-bold">Reading momentum</h3>
      </div>
      <AppIcon icon={APP_ICONS.journey.badges} variant="status" size="lg" />
    </div>
    {reward ? (
      <div className="mt-5">
        <p className="font-medium">{reward.display_name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{new Date(reward.created_at).toLocaleString()}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {reward.ink_delta > 0 && (
            <Badge variant="secondary" className="gap-1.5 py-1">
              <CurrencyIcon currency="ink" size="md" />
              +{reward.ink_delta.toLocaleString()} Ink
            </Badge>
          )}
          {reward.gold_leaves_delta > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1">
              <CurrencyIcon currency="goldLeaves" size="md" />
              +{reward.gold_leaves_delta.toLocaleString()} Gold {reward.gold_leaves_delta === 1 ? "Leaf" : "Leaves"}
            </Badge>
          )}
        </div>
      </div>
    ) : (
      <JourneyInlineEmpty
        title="Your first reward is ahead"
        description="Qualifying reading activity will appear here."
      />
    )}
  </JourneySurface>
);
