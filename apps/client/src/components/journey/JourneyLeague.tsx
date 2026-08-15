import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import LoadingSpinner from "@/components/LoadingSpinner";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import {
  JourneySectionEyebrow,
  JourneySurface,
} from "@/components/journey/JourneySurface";
import { useJourneyCountdown } from "@/components/journey/useJourneyCountdown";
import { cn } from "@/lib/utils";
import type {
  GamificationAccount,
  LeaderboardEntry,
  LeaderboardScope,
  ReaderLeague,
} from "@/services/api/gamification";

interface JourneyLeagueProps {
  enabled: boolean;
  account: GamificationAccount;
  league: ReaderLeague | null;
  cutoff: string;
  serverTime: string;
  receivedAt?: string | null;
  scope: LeaderboardScope;
  mobile: boolean;
  savingOptIn: boolean;
  loading: boolean;
  refreshing: boolean;
  cached: boolean;
  error: Error | null;
  entries: LeaderboardEntry[];
  onScopeChange: (scope: LeaderboardScope) => void;
  onOptInChange: (checked: boolean) => void;
  onRetry: () => void;
}

export const JourneyLeague = ({
  enabled,
  account,
  league,
  cutoff,
  serverTime,
  receivedAt,
  scope,
  mobile,
  savingOptIn,
  loading,
  refreshing,
  cached,
  error,
  entries,
  onScopeChange,
  onOptInChange,
  onRetry,
}: JourneyLeagueProps) => {
  if (!enabled) {
    return (
      <PremiumEmptyState
        asset="emptyReaders"
        title="Reader Leagues are paused"
        description="Your Ink, levels, and quests continue to work."
      />
    );
  }

  if (!account.leaderboard_opt_in) {
    return (
      <JourneySurface variant="hero" className="space-y-4 p-6">
        <JourneySectionEyebrow>Optional weekly competition</JourneySectionEyebrow>
        <h2 className="font-display text-2xl font-bold">Join Reader Leagues</h2>
        <p className="max-w-2xl text-muted-foreground">
          Meet a weekly group of readers and rank with qualifying reading activity. Your level and quests work whether you join or not.
        </p>
        <Button className="min-h-11" onClick={() => onOptInChange(true)} disabled={savingOptIn}>
          {savingOptIn ? "Joining..." : "Join next week"}
        </Button>
      </JourneySurface>
    );
  }

  return (
    <div className="space-y-5">
      <LeagueHeader
        league={league}
        cutoff={cutoff}
        serverTime={serverTime}
        receivedAt={receivedAt}
        eligibleFrom={account.leaderboard_eligible_from}
        savingOptIn={savingOptIn}
        onOptInChange={onOptInChange}
      />
      <LeaderboardScopePicker scope={scope} onChange={onScopeChange} mobile={mobile} />
      <LeaderboardTable
        loading={loading}
        refreshing={refreshing}
        cached={cached}
        error={error}
        entries={entries}
        onRetry={onRetry}
        fallbackCurrent={scope === "league" && league ? {
          rank: league.provisional_rank,
          competitiveInk: league.score,
          levelTitle: account.level_title,
        } : undefined}
      />
    </div>
  );
};

const LeagueHeader = ({
  league,
  cutoff,
  serverTime,
  receivedAt,
  eligibleFrom,
  savingOptIn,
  onOptInChange,
}: {
  league: ReaderLeague | null;
  cutoff: string;
  serverTime: string;
  receivedAt?: string | null;
  eligibleFrom: string | null;
  savingOptIn: boolean;
  onOptInChange: (checked: boolean) => void;
}) => {
  const countdown = useJourneyCountdown(cutoff, serverTime, "UTC", receivedAt);

  return (
    <JourneySurface variant="hero" className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <JourneySectionEyebrow>{league?.status === "finalized" ? "Final standings" : "Weekly standings"}</JourneySectionEyebrow>
          <h2 className="font-display text-2xl font-bold">
            {league ? `${league.name} · Tier ${league.tier}` : "Assignment pending"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {league
              ? league.status === "finalized" ? "This league week is complete." : countdown
              : eligibleFrom
                ? `Your first league begins ${new Date(`${eligibleFrom}T00:00:00`).toLocaleDateString()}.`
                : "Brack is preparing your next weekly group."}
          </p>
        </div>
        <div className="flex min-h-11 items-center gap-3 rounded-full border border-border/70 bg-background/60 px-3 text-sm">
          <span>Participating</span>
          <Switch
            checked
            disabled={savingOptIn}
            onCheckedChange={onOptInChange}
            className="relative touch-manipulation after:absolute after:-inset-x-1.5 after:-inset-y-2.5 after:content-['']"
            aria-label="Participate in Reader Leagues"
          />
        </div>
      </div>
      {league && (
        <div className="mt-5 flex flex-wrap gap-6">
          <div>
            <strong className="block text-3xl">#{league.provisional_rank}</strong>
            <span className="text-xs text-muted-foreground">of {league.member_count} readers</span>
          </div>
          <div>
            <strong className="inline-flex items-center gap-1 text-2xl">
              <CurrencyIcon currency="ink" size="lg" />
              {league.score.toLocaleString()}
            </strong>
            <span className="block text-xs text-muted-foreground">competitive Ink</span>
          </div>
        </div>
      )}
    </JourneySurface>
  );
};

const LeaderboardScopePicker = ({
  scope,
  onChange,
  mobile,
}: {
  scope: LeaderboardScope;
  onChange: (scope: LeaderboardScope) => void;
  mobile: boolean;
}) => mobile ? (
  <div className="space-y-1.5">
    <label htmlFor="leaderboard-scope" className="text-sm font-medium">Ranking group</label>
    <Select value={scope} onValueChange={(value) => onChange(value as LeaderboardScope)}>
      <SelectTrigger id="leaderboard-scope" className="min-h-11">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="league">My league</SelectItem>
        <SelectItem value="friends">Friends</SelectItem>
        <SelectItem value="global">Global top 100</SelectItem>
      </SelectContent>
    </Select>
  </div>
) : (
  <Tabs value={scope} onValueChange={(value) => onChange(value as LeaderboardScope)}>
    <TabsList className="grid h-auto w-full max-w-xl grid-cols-3">
      <TabsTrigger className="min-h-11" value="league">My league</TabsTrigger>
      <TabsTrigger className="min-h-11" value="friends">Friends</TabsTrigger>
      <TabsTrigger className="min-h-11" value="global">Global top 100</TabsTrigger>
    </TabsList>
  </Tabs>
);

export const LeaderboardTable = ({
  loading,
  refreshing,
  cached,
  error,
  entries,
  onRetry,
  fallbackCurrent,
}: {
  loading: boolean;
  refreshing: boolean;
  cached: boolean;
  error: Error | null;
  entries: LeaderboardEntry[];
  onRetry: () => void;
  fallbackCurrent?: { rank: number; competitiveInk: number; levelTitle: string };
}) => {
  const currentVisible = entries.some((entry) => entry.is_current_user);
  const podiumEntries = entries
    .filter((entry) => entry.rank <= 3)
    .sort((left, right) => left.rank - right.rank);

  if (loading) {
    return (
      <JourneySurface variant="flat" className="flex min-h-64 items-center justify-center">
        <LoadingSpinner text="Loading standings..." />
      </JourneySurface>
    );
  }

  if (error) {
    return (
      <JourneySurface variant="flat" className="p-7 text-center">
        <p className="font-display text-xl font-bold">Standings could not be loaded</p>
        <p className="mt-1 text-sm text-muted-foreground">Your Ink and quest progress are still safe.</p>
        <Button className="mt-4 min-h-11" variant="outline" onClick={onRetry}>Try again</Button>
      </JourneySurface>
    );
  }

  if (entries.length === 0) {
    return (
      <PremiumEmptyState
        asset="emptyReaders"
        title="No ranked readers yet"
        description={cached
          ? "Saved standings contain no ranked readers. Refresh when reconnected."
          : "Qualifying activity will populate this ranking."}
        size="compact"
        action={<Button className="min-h-11" variant="outline" onClick={onRetry}>Refresh</Button>}
      />
    );
  }

  return (
    <div className="space-y-3">
      {cached && (
        <JourneySurface
          variant="flat"
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          role="status"
        >
          <p className="text-sm text-muted-foreground">
            Saved standings shown while the live League is unavailable.
          </p>
          <Button size="sm" className="min-h-11" variant="outline" onClick={onRetry}>Refresh</Button>
        </JourneySurface>
      )}
      {refreshing && <p className="text-right text-xs text-muted-foreground" role="status">Refreshing standings…</p>}
      {!currentVisible && fallbackCurrent && (
        <JourneySurface variant="hero" className="sticky top-[8rem] z-20 flex items-center justify-between gap-3 p-3" role="status">
          <span>
            <strong>You · #{fallbackCurrent.rank}</strong>
            <span className="ml-2 text-xs text-muted-foreground">{fallbackCurrent.levelTitle}</span>
          </span>
          <strong className="inline-flex items-center gap-1">
            <CurrencyIcon currency="ink" size="md" />
            {fallbackCurrent.competitiveInk.toLocaleString()}
          </strong>
        </JourneySurface>
      )}
      {podiumEntries.length > 0 && (
        <ol
          className="journey-league-podium grid-cols-3 items-end gap-3 pt-3"
          aria-label="Reader League podium"
        >
          {podiumEntries.map((entry) => (
            <li
              key={`podium-${entry.user_id}`}
              className={cn(
                "rounded-2xl border border-border/70 bg-card p-4 text-center",
                entry.rank === 1 && "order-2 border-primary/[0.42] bg-primary/[0.08] pb-6 shadow-md",
                entry.rank === 2 && "order-1",
                entry.rank === 3 && "order-3",
              )}
            >
              <span className="mx-auto grid h-9 w-9 place-items-center rounded-full border border-primary/[0.28] bg-primary/[0.08] text-sm font-bold">
                {["1st", "2nd", "3rd"][entry.rank - 1]}
              </span>
              <Avatar className={cn("mx-auto mt-3", entry.rank === 1 ? "h-16 w-16" : "h-12 w-12")}>
                <AvatarImage src={entry.avatar_url || undefined} />
                <AvatarFallback>{entry.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <p className="mt-2 truncate font-medium" title={entry.display_name}>
                {entry.display_name}{entry.is_current_user ? " · You" : ""}
              </p>
              <p className="truncate text-xs text-muted-foreground">{entry.level_title || "Fresh Ink"}</p>
              <strong className="mt-3 inline-flex items-center gap-1">
                <CurrencyIcon currency="ink" size="md" />
                {entry.competitive_ink.toLocaleString()} Ink
              </strong>
              <p className="mt-2 text-xs text-muted-foreground">
                {entry.quests_completed} quests · {entry.qualifying_minutes} min · {entry.reading_days} days
              </p>
            </li>
          ))}
        </ol>
      )}
      <JourneySurface variant="flat" className="overflow-hidden">
        <ol className="divide-y divide-border/70" aria-label="Reader League standings">
          {entries.map((entry) => (
            <li
              key={entry.user_id}
              data-testid={`league-row-${entry.rank}`}
              className={cn(entry.rank <= 3 && "journey-league-top-entry")}
            >
              <details
                className={cn(
                  "group",
                  entry.is_current_user && "bg-primary/[0.08]",
                  entry.rank <= 3 && "bg-primary/[0.035]",
                )}
              >
                <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <span className={cn(
                    "grid h-9 w-9 place-items-center rounded-full text-sm font-bold",
                    entry.rank <= 3 ? "border border-primary/[0.28] bg-primary/[0.08]" : "text-muted-foreground",
                  )}>
                    {entry.rank <= 3 ? ["1st", "2nd", "3rd"][entry.rank - 1] : `#${entry.rank}`}
                  </span>
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={entry.avatar_url || undefined} />
                      <AvatarFallback>{entry.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {entry.display_name}{entry.is_current_user ? " · You" : ""}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{entry.level_title || "Fresh Ink"}</span>
                    </span>
                  </span>
                  <strong className="inline-flex items-center gap-1 text-sm sm:text-base">
                    <CurrencyIcon currency="ink" size="md" />
                    {entry.competitive_ink.toLocaleString()}
                    <span className="hidden sm:inline"> Ink</span>
                  </strong>
                </summary>
                <div className="grid grid-cols-3 gap-2 border-t border-border/50 bg-muted/25 px-4 py-3 text-center text-xs">
                  <span><strong className="block text-sm">{entry.quests_completed}</strong>quests</span>
                  <span><strong className="block text-sm">{entry.qualifying_minutes}</strong>minutes</span>
                  <span><strong className="block text-sm">{entry.reading_days}</strong>reading days</span>
                </div>
              </details>
            </li>
          ))}
        </ol>
      </JourneySurface>
    </div>
  );
};
