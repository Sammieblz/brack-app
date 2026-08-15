import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Medal1st, NavArrowRight } from "iconoir-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ProgressLogger } from "@/components/ProgressLogger";
import { PullToRefresh } from "@/components/PullToRefresh";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { NativeHeader } from "@/components/NativeHeader";
import { NativeScrollView } from "@/components/NativeScrollView";
import { GoalsSheet } from "@/components/GoalsSheet";
import { AppIcon } from "@/components/ui/app-icon";
import { ReaderHud } from "@/components/ReaderHud";
import { DailyFocusCard } from "@/components/DailyFocusCard";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { DashboardCardSkeleton } from "@/components/skeletons/DashboardCardSkeleton";
import { ActivityItemSkeleton } from "@/components/skeletons/ActivityItemSkeleton";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDashboardHomeData, type DashboardBookCandidate } from "@/hooks/useDashboardHomeData";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useTimer } from "@/contexts/TimerContext";
import type { Book as BookType, OnboardingStatus } from "@/types";
import type {
  DashboardJourneyFreshness,
  DashboardMilestone,
  DashboardRecentActivity,
  DashboardStreakFreezeSummary,
} from "@/services/api/dashboard";
import type { DashboardStreakSummary } from "@/services/api/dashboard";
import type { QuestAssignment, ReaderLeague } from "@/services/api/gamification";
import { applyReadingStreakFreeze } from "@/services/api";
import { needsSetupPrompt } from "@/services/onboarding";
import { trackCoreEvent } from "@/services/telemetry";
import {
  getDateKeyInTimeZone,
  getGoalProgressDetails,
  getRecentActivityInsight,
  selectDailyFocusQuest,
  type DailyFocusAction,
} from "@/lib/dashboardGamification";
import { observeDashboardRewards } from "@/lib/dashboardRewards";
import { APP_ICONS } from "@/config/iconography";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { profile } = useProfileContext();
  const { status: onboardingStatus } = useOnboardingStatus(user?.id);
  const { gamificationEnabled } = useFeatureFlags();
  const { startTimer } = useTimer();
  const {
    dashboardHome,
    journey,
    primaryBook,
    secondaryBooks,
    loading,
    error,
    journeyError,
    source,
    cachedAt,
    journeyFreshness,
    canMutateEconomy,
    provisional,
    refetch,
  } = useDashboardHomeData(user?.id, gamificationEnabled);
  const [progressBook, setProgressBook] = useState<BookType | null>(null);
  const [usingFreeze, setUsingFreeze] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, navigate, user]);

  const dailyFocus = useMemo(
    () => selectDailyFocusQuest(journey?.quests),
    [journey?.quests],
  );
  const goalProgress = useMemo(
    () => getGoalProgressDetails(dashboardHome?.activeGoal, dashboardHome?.stats),
    [dashboardHome?.activeGoal, dashboardHome?.stats],
  );
  const recentActivityInsight = useMemo(
    () => getRecentActivityInsight(dashboardHome?.recentActivity),
    [dashboardHome?.recentActivity],
  );
  const timezone = journey?.timezone || profile?.timezone || "UTC";
  const journeyPeriodIsCurrent = journeyFreshness !== "expired";

  useConfirmedRewardToast({
    userId: user?.id,
    journey,
    source,
    provisional,
    journeyFreshness,
  });

  const telemetryFreshness = toTelemetryFreshness(journeyFreshness, provisional);
  const handleFocusAction = (action: DailyFocusAction, quest: QuestAssignment) => {
    const telemetryMetric = toTelemetryQuestMetric(quest.metric);
    if (telemetryMetric) {
      trackCoreEvent("daily_focus_started", {
        source: "dashboard_daily_focus",
        quest_metric: telemetryMetric,
        ...(telemetryFreshness ? { freshness: telemetryFreshness } : {}),
      });
    }

    if (action === "timer" && primaryBook) {
      startTimer(primaryBook.book.id, primaryBook.book.title);
      toast.success("Reading timer started", { description: primaryBook.book.title });
      return;
    }
    if (action === "progress" && primaryBook) {
      setProgressBook(primaryBook.book);
      return;
    }
    navigate("/my-books");
  };

  const handleUseFreeze = async () => {
    if (!user || !journey?.streak_freeze || journey.streak_freeze.quantity <= 0) {
      navigate("/achievements?tab=shop");
      return;
    }
    if (!canMutateEconomy || journeyFreshness !== "live") {
      toast.error("Reconnect before using a Streak Freeze.");
      return;
    }

    setUsingFreeze(true);
    try {
      await applyReadingStreakFreeze(
        user.id,
        getDateKeyInTimeZone(new Date(), timezone),
      );
      toast.success("Streak protected", {
        description: "One Streak Freeze protected your current local reading day.",
      });
      await refetch({ forceRefresh: true });
    } catch (freezeError) {
      console.error("Failed to use Streak Freeze", freezeError);
      toast.error("Your current reading day is not eligible for a Streak Freeze, or your inventory changed. Refresh and try again.");
    } finally {
      setUsingFreeze(false);
    }
  };

  const handleRefresh = async () => {
    await refetch({ forceRefresh: true });
  };

  const handleProgressSuccess = async () => {
    setProgressBook(null);
    await refetch({ forceRefresh: true });
  };

  if (authLoading) {
    return (
      <MobileLayout showBottomNav={false}>
        <div className="flex h-96 items-center justify-center">
          <LoadingSpinner size="lg" text="Loading your reading journey..." />
        </div>
      </MobileLayout>
    );
  }

  const readerHud = gamificationEnabled ? (
    <ReaderHud
      account={journey?.account}
      currentStreak={dashboardHome?.streak.currentStreak}
      freeze={journey?.streak_freeze}
      freshness={journeyFreshness}
      cachedAt={cachedAt}
      provisional={provisional}
      loading={loading}
      error={journeyError || error}
      onRetry={() => void refetch({ forceRefresh: true })}
    />
  ) : undefined;

  const hasAnyBooks = (dashboardHome?.stats.totalBooks ?? 0) > 0;

  return (
    <MobileLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        {isMobile ? (
          <MobileHeader title="Home" action={<GoalsSheet />} secondary={readerHud} />
        ) : (
          <NativeHeader
            title={profile?.display_name ? `Welcome back, ${profile.display_name}` : "Welcome back"}
            subtitle="Your next page, quest, and reward are ready"
            action={<GoalsSheet />}
            secondary={readerHud}
            scrollContainerId="dashboard-scroll"
            showTimerAction={false}
          />
        )}

        <NativeScrollView id="dashboard-scroll" className="app-page space-y-5 md:space-y-6">
          {needsSetupPrompt(onboardingStatus?.onboarding_status) && (
            <SetupPromptCard
              status={onboardingStatus?.onboarding_status}
              onResume={() => navigate("/onboarding?from=dashboard")}
            />
          )}

          <ContinueReadingSection
            loading={loading}
            error={error}
            primaryBook={primaryBook}
            secondaryBooks={secondaryBooks}
            hasAnyBooks={hasAnyBooks}
            onAddBook={() => navigate("/add-book")}
            onScanBook={() => navigate("/scan-barcode")}
            onLogProgress={(book) => setProgressBook(book)}
            onViewLibrary={() => navigate("/my-books")}
          />

          {gamificationEnabled && journey && journeyPeriodIsCurrent && (
            <DailyFocusCard
              quest={dailyFocus}
              serverTime={journey.server_time}
              timezone={journey.timezone}
              receivedAt={cachedAt}
              freshness={journeyFreshness}
              provisional={provisional}
              hasCurrentBook={Boolean(primaryBook)}
              onAction={handleFocusAction}
            />
          )}

          {gamificationEnabled && journey && !journeyPeriodIsCurrent && (
            <ExpiredJourneyCard onRetry={() => void refetch({ forceRefresh: true })} />
          )}

          {gamificationEnabled && !journey && !loading && (
            <JourneyUnavailableCard
              message={journeyError}
              onRetry={() => void refetch({ forceRefresh: true })}
            />
          )}

          {dashboardHome && (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 28rem), 1fr))" }}
            >
              <MomentumCard
                streak={dashboardHome.streak}
                showJourney={gamificationEnabled}
                league={journeyPeriodIsCurrent ? journey?.league ?? null : null}
                leagueCutoff={journeyPeriodIsCurrent ? journey?.week.scoring_closes_at ?? null : null}
                freeze={journey?.streak_freeze ?? null}
                canMutateFreeze={canMutateEconomy}
                usingFreeze={usingFreeze}
                onUseFreeze={() => void handleUseFreeze()}
                onOpenShop={() => navigate("/achievements?tab=shop")}
              />
              <GoalAndInsightCard
                goalProgress={goalProgress}
                recentActivityCount={recentActivityInsight.activityCount}
                recentSessionMinutes={recentActivityInsight.sessionMinutes}
                milestone={journey?.latest_milestone ?? null}
                onManageGoals={() => navigate("/goals-management")}
              />
            </div>
          )}

          <section
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 28rem), 1fr))" }}
          >
            <ListsShortcutCard />
            <RecentActivityCard
              activities={dashboardHome?.recentActivity ?? []}
              loading={loading}
              onViewHistory={() => navigate("/history")}
            />
          </section>
        </NativeScrollView>
      </PullToRefresh>

      {progressBook && (
        <ProgressLogger
          bookId={progressBook.id}
          bookTitle={progressBook.title}
          currentPage={progressBook.current_page || 0}
          open
          onOpenChange={(open) => {
            if (!open) setProgressBook(null);
          }}
          onSuccess={handleProgressSuccess}
        />
      )}
    </MobileLayout>
  );
};

interface RewardToastObserverProps {
  userId?: string;
  journey: ReturnType<typeof useDashboardHomeData>["journey"];
  source: "live" | "cached" | null;
  provisional: boolean;
  journeyFreshness: DashboardJourneyFreshness;
}

const useConfirmedRewardToast = ({
  userId,
  journey,
  source,
  provisional,
  journeyFreshness,
}: RewardToastObserverProps) => {
  useEffect(() => {
    if (
      !userId
      || !journey
      || source !== "live"
      || journeyFreshness !== "live"
      || provisional
    ) return;

    const rewards = journey.recent_rewards?.length
      ? journey.recent_rewards
      : journey.latest_milestone?.kind === "reward"
        ? [{
            id: journey.latest_milestone.id,
            ink_delta: journey.latest_milestone.ink_delta,
            gold_leaves_delta: journey.latest_milestone.gold_leaves_delta,
          }]
        : [];
    if (rewards.length === 0) return;

    const key = `brack:journey:last-seen-reward:${userId}`;
    let previousId: string | null;
    try {
      previousId = localStorage.getItem(key);
    } catch {
      // Without a durable cursor, suppress feedback so old rewards cannot replay.
      return;
    }

    const observation = observeDashboardRewards(rewards, previousId);
    if (!observation.newestId) return;
    try {
      localStorage.setItem(key, observation.newestId);
    } catch {
      // A toast without a persisted cursor would replay on the next render.
      return;
    }
    const confirmed = observation.confirmed;
    if (confirmed.length === 0) return;

    const ink = confirmed.reduce((total, reward) => total + Math.max(0, reward.ink_delta), 0);
    const gold = confirmed.reduce((total, reward) => total + Math.max(0, reward.gold_leaves_delta), 0);
    const rewardSummary = [
      ink > 0 ? `+${ink.toLocaleString()} Ink` : null,
      gold > 0 ? `+${gold.toLocaleString()} Gold Leaves` : null,
    ].filter(Boolean).join(" and ");
    toast.success(confirmed.length === 1 ? "Reward confirmed" : `${confirmed.length} rewards confirmed`, {
      description: rewardSummary || "Your Reader Journey has been updated.",
    });
  }, [journey, journeyFreshness, provisional, source, userId]);
};

interface SetupPromptCardProps {
  status?: OnboardingStatus;
  onResume: () => void;
}

const SetupPromptCard = ({ status, onResume }: SetupPromptCardProps) => {
  const isSkipped = status === "skipped";
  return (
    <Card className="overflow-hidden border-primary/35 bg-primary/[0.08]">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">
            {isSkipped ? "Finish your reading profile" : "Complete your setup"}
          </h2>
          <p className="mt-1 font-sans text-sm text-muted-foreground">
            Add your taste, pace, and goals so Brack can personalize this daily reading loop.
          </p>
        </div>
        <Button size="sm" onClick={onResume} className="shrink-0">
          {isSkipped ? "Finish" : "Resume"}
          <NavArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

interface ContinueReadingSectionProps {
  loading: boolean;
  error: string | null;
  primaryBook: DashboardBookCandidate | null;
  secondaryBooks: DashboardBookCandidate[];
  hasAnyBooks: boolean;
  onAddBook: () => void;
  onScanBook: () => void;
  onLogProgress: (book: BookType) => void;
  onViewLibrary: () => void;
}

const ContinueReadingSection = ({
  loading,
  error,
  primaryBook,
  secondaryBooks,
  hasAnyBooks,
  onAddBook,
  onScanBook,
  onLogProgress,
  onViewLibrary,
}: ContinueReadingSectionProps) => (
  <section className="space-y-3" aria-labelledby="continue-reading-heading">
    <SectionHeader
      id="continue-reading-heading"
      title={primaryBook?.book.status === "to_read" ? "Pick up a book" : "Continue reading"}
      subtitle="Your most useful next action, based on recent activity"
      action={hasAnyBooks ? (
        <Button variant="outline" size="sm" onClick={onViewLibrary}>
          Library <NavArrowRight className="h-4 w-4" />
        </Button>
      ) : undefined}
    />

    {loading ? (
      <DashboardCardSkeleton />
    ) : primaryBook ? (
      <div className="space-y-3">
        <PrimaryContinueCard candidate={primaryBook} onLogProgress={onLogProgress} />
        {secondaryBooks.length > 0 && (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))" }}
            aria-label="More current books"
          >
            {secondaryBooks.map((candidate) => (
              <SecondaryContinueCard key={candidate.book.id} candidate={candidate} />
            ))}
          </div>
        )}
      </div>
    ) : (
      <PremiumEmptyState
        asset="emptyLibrary"
        title={hasAnyBooks ? "Choose your next read" : "Add your first book"}
        description={
          <>
            {hasAnyBooks
              ? "Nothing is currently in progress. Choose a book from your library."
              : "Start your library so Brack can build a useful daily reading loop."}
            {error && <span className="mt-2 block text-xs text-destructive">{error}</span>}
          </>
        }
        size="compact"
        action={
          <>
            <Button onClick={hasAnyBooks ? onViewLibrary : onAddBook}>
              {hasAnyBooks ? "Open library" : "Add book"}
            </Button>
            {!hasAnyBooks && (
              <Button variant="outline" onClick={onScanBook}>
                Scan a book
              </Button>
            )}
          </>
        }
      />
    )}
  </section>
);

const PrimaryContinueCard = ({
  candidate,
  onLogProgress,
}: {
  candidate: DashboardBookCandidate;
  onLogProgress: (book: BookType) => void;
}) => {
  const { book } = candidate;
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-4 md:p-5">
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
          <Link to={`/book/${book.id}`} aria-label={`Open ${book.title}`} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BookCover book={book} className="h-32 w-[5.5rem] sm:h-40 sm:w-28" />
          </Link>
          <div className="min-w-0 space-y-3">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">{book.status.replace("_", " ")}</Badge>
                <span className="font-sans text-xs text-muted-foreground">
                  {getActivityTypeLabel(candidate.lastActivityType)} {formatTimeAgo(candidate.lastActivityAt)}
                </span>
              </div>
              <Link to={`/book/${book.id}`} className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <h3 className="line-clamp-2 font-display text-xl font-bold leading-tight sm:text-2xl">{book.title}</h3>
              </Link>
              {book.author && <p className="truncate font-serif text-sm text-muted-foreground">by {book.author}</p>}
            </div>
            <div>
              <div className="mb-1 flex justify-between gap-3 font-sans text-xs">
                <span className="truncate text-muted-foreground">
                  {book.pages ? `${book.current_page || 0} of ${book.pages} pages` : "Reading progress"}
                </span>
                <span className="font-semibold tabular-nums">{candidate.progressPercent}%</span>
              </div>
              <Progress
                value={candidate.progressPercent}
                className="h-2"
                aria-label={`${book.title} reading progress`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to={`/book/${book.id}`}>{candidate.ctaLabel}<NavArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button variant="outline" onClick={() => onLogProgress(book)}>Log progress</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SecondaryContinueCard = ({ candidate }: { candidate: DashboardBookCandidate }) => {
  const { book } = candidate;
  return (
    <Link
      to={`/book/${book.id}`}
      className="flex min-h-28 gap-3 rounded-xl border border-border/70 bg-card p-3 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <BookCover book={book} className="h-20 w-14" />
      <span className="min-w-0 flex-1 space-y-2">
        <span>
          <span className="block line-clamp-2 font-serif text-sm font-semibold leading-snug">{book.title}</span>
          {book.author && <span className="block truncate font-serif text-xs text-muted-foreground">by {book.author}</span>}
        </span>
        <Progress value={candidate.progressPercent} className="h-1.5" aria-label={`${book.title} reading progress`} />
        <span className="block font-sans text-xs text-muted-foreground">
          {getActivityTypeLabel(candidate.lastActivityType)} {formatTimeAgo(candidate.lastActivityAt)}
        </span>
      </span>
    </Link>
  );
};

const JourneyUnavailableCard = ({ message, onRetry }: { message: string | null; onRetry: () => void }) => (
  <Card className="border-dashed border-border/80">
    <CardContent className="flex items-center justify-between gap-4 p-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Daily Focus is taking a pause</h2>
        <p className="font-sans text-sm text-muted-foreground">
          {message || "Your books and reading progress are still available."}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
    </CardContent>
  </Card>
);

const ExpiredJourneyCard = ({ onRetry }: { onRetry: () => void }) => (
  <Card className="border-dashed border-border/80">
    <CardContent className="flex items-center justify-between gap-4 p-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Reconnect for today&apos;s Daily Focus</h2>
        <p className="font-sans text-sm text-muted-foreground">
          Your level and wallet are saved, but the cached quest and league period has ended.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>Refresh</Button>
    </CardContent>
  </Card>
);

interface MomentumCardProps {
  streak: DashboardStreakSummary;
  showJourney: boolean;
  league: ReaderLeague | null;
  leagueCutoff: string | null;
  freeze: DashboardStreakFreezeSummary | null;
  canMutateFreeze: boolean;
  usingFreeze: boolean;
  onUseFreeze: () => void;
  onOpenShop: () => void;
}

export const MomentumCard = ({
  streak,
  showJourney,
  league,
  leagueCutoff,
  freeze,
  canMutateFreeze,
  usingFreeze,
  onUseFreeze,
  onOpenShop,
}: MomentumCardProps) => {
  const inventoryIsKnown = Boolean(freeze);
  const freezeQuantity = freeze?.quantity ?? 0;

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <AppIcon icon={APP_ICONS.dashboard.streak} variant="inline" className="text-primary" />
          Momentum
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Metric value={streak.currentStreak} label="day streak" primary />
          <Metric value={streak.longestStreak} label="personal best" />
        </div>

        {showJourney && (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/[0.35] p-3">
            <Badge variant="outline" className="gap-1.5">
              <AppIcon icon={APP_ICONS.stats.freezeStatus} variant="inline" size="xs" />
              {inventoryIsKnown
                ? `${freezeQuantity} ${freezeQuantity === 1 ? "Freeze" : "Freezes"}`
                : "Inventory unavailable"}
            </Badge>
            {!inventoryIsKnown ? (
              <Button variant="outline" size="sm" disabled>
                Inventory unavailable
              </Button>
            ) : freezeQuantity > 0 ? (
              <Button
                variant="outline"
                size="sm"
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
              <Button variant="ghost" size="sm" onClick={onOpenShop}>
                {canMutateFreeze ? "Get a Freeze" : "View shop"}
              </Button>
            )}
            <span className="basis-full font-sans text-xs text-muted-foreground">
              {!inventoryIsKnown
                ? "Reconnect and refresh to check your Streak Freeze inventory."
                : !canMutateFreeze
                  ? "Cached count only. Reconnect before buying or using inventory."
                  : freezeQuantity > 0
                    ? "Brack checks your current local reading day, prior reading, and cooldown before consuming one."
                    : "Buy protection before you need it; eligibility is checked when a Freeze is used."}
            </span>
            </div>

            <Link
              to="/achievements?tab=rankings"
              className="flex min-h-16 items-center justify-between gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/[0.1] text-primary">
                <Medal1st className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-sm font-semibold">
                  {league ? `${league.name} · Rank #${league.provisional_rank}` : "Weekly Reader League"}
                </span>
                <span className="block truncate font-sans text-xs text-muted-foreground">
                  {league
                    ? `${league.score.toLocaleString()} competitive Ink · ${league.member_count} readers`
                    : "See how your weekly reading compares"}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-right font-sans text-xs text-muted-foreground">
              {leagueCutoff && Number.isFinite(Date.parse(leagueCutoff))
                ? `Ends ${format(new Date(leagueCutoff), "MMM d")}`
                : "View league"}
            </span>
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const GoalAndInsightCard = ({
  goalProgress,
  recentActivityCount,
  recentSessionMinutes,
  milestone,
  onManageGoals,
}: {
  goalProgress: ReturnType<typeof getGoalProgressDetails>;
  recentActivityCount: number;
  recentSessionMinutes: number;
  milestone: DashboardMilestone | null;
  onManageGoals: () => void;
}) => (
  <Card className="h-full overflow-hidden">
    <CardHeader className="border-b border-border/60 pb-3">
      <div className="flex items-center justify-between gap-3">
        <CardTitle className="font-display text-lg">Progress pulse</CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to="/analytics">Analytics <NavArrowRight className="h-4 w-4" /></Link>
        </Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-4 p-4">
      <p className="font-sans text-xs text-muted-foreground">
        A snapshot of the latest {recentActivityCount} {recentActivityCount === 1 ? "update" : "updates"} loaded on Home.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Metric value={recentActivityCount} label="recent updates" primary />
        <Metric value={recentSessionMinutes} label="session min in sample" />
      </div>

      <div className="rounded-lg border border-border/60 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold">Reading goal</h3>
            <p className="font-sans text-xs text-muted-foreground">
              {goalProgress
                ? `${goalProgress.current.toLocaleString()} of ${goalProgress.target.toLocaleString()} ${goalProgress.unit}`
                : "Set a goal to give your reading a longer arc."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onManageGoals}>
            {goalProgress ? "Manage" : "Set goal"}
          </Button>
        </div>
        {goalProgress && (
          <Progress
            value={goalProgress.percent}
            className="mt-3 h-2"
            aria-label={`Reading goal ${Math.round(goalProgress.percent)} percent complete`}
          />
        )}
      </div>

      {milestone && (
        <Link
          to="/achievements"
          className="flex min-h-16 items-center gap-3 rounded-lg border border-primary/20 bg-primary/[0.06] p-3 transition-colors hover:bg-primary/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/[0.12] text-primary">
            {milestone.kind === "badge" ? <Medal1st className="h-5 w-5" /> : <CurrencyIcon currency="ink" className="h-7 w-7" />}
          </span>
          <span className="min-w-0">
            <span className="block font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Latest {milestone.kind === "badge" ? "achievement" : "reward"}
            </span>
            <span className="block truncate font-display text-sm font-semibold">{milestone.title}</span>
          </span>
          <NavArrowRight className="ml-auto h-4 w-4 shrink-0" />
        </Link>
      )}
    </CardContent>
  </Card>
);

const Metric = ({ value, label, primary = false }: { value: number; label: string; primary?: boolean }) => (
  <div className="min-w-0 rounded-lg border border-border/60 bg-muted/[0.25] p-3">
    <div className={`truncate font-display text-2xl font-bold tabular-nums ${primary ? "text-primary" : "text-foreground"}`}>
      {value.toLocaleString()}
    </div>
    <p className="truncate font-sans text-xs text-muted-foreground">{label}</p>
  </div>
);

const RecentActivityCard = ({
  activities,
  loading,
  onViewHistory,
}: {
  activities: DashboardRecentActivity[];
  loading: boolean;
  onViewHistory: () => void;
}) => {
  const visibleActivities = activities.slice(0, 5);
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="font-display text-lg">Recent activity</CardTitle>
            <p className="font-sans text-sm text-muted-foreground">Your latest reading trail</p>
          </div>
          <Button variant="outline" size="sm" onClick={onViewHistory}>History</Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {loading ? (
          <div className="space-y-3"><ActivityItemSkeleton /><ActivityItemSkeleton /><ActivityItemSkeleton /></div>
        ) : visibleActivities.length === 0 ? (
          <PremiumEmptyState
            asset="emptyProgress"
            title="No activity yet"
            description="Start reading to see your progress here."
            size="compact"
            className="border-dashed bg-background/45"
          />
        ) : (
          <ol className="space-y-1">
            {visibleActivities.map((activity) => {
              const description = getActivityDescription(activity);
              return (
                <li key={activity.id} className="flex min-h-14 gap-3 rounded-lg p-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/[0.1] text-primary">
                    <ActivityIcon type={activity.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-sans text-sm">{description.label}</span>
                    {description.bookTitle && <span className="block truncate font-serif text-xs text-muted-foreground">{description.bookTitle}</span>}
                  </span>
                  <span className="shrink-0 font-sans text-[11px] text-muted-foreground">{formatTimeAgo(activity.timestamp)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
};

const ListsShortcutCard = () => (
  <Card className="h-full overflow-hidden">
    <CardContent className="flex h-full min-h-48 flex-col justify-between gap-5 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/[0.1] text-primary">
          <AppIcon icon={APP_ICONS.library.bookLists} variant="inline" />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold">Reading lists</h2>
          <p className="mt-1 max-w-md font-serif text-sm text-muted-foreground">
            Shape your next reading arc without adding another feed to Home.
          </p>
        </div>
      </div>
      <Button asChild variant="outline" className="self-start">
        <Link to="/book-lists">Open lists <NavArrowRight className="h-4 w-4" /></Link>
      </Button>
    </CardContent>
  </Card>
);

const getActivityDescription = (activity: DashboardRecentActivity) => {
  const title = typeof activity.details.title === "string" ? activity.details.title : null;
  if (activity.type === "reading_session") {
    const minutes = Number(activity.details.duration ?? 0);
    return { label: minutes > 0 ? `Read for ${minutes} minutes` : "Finished a reading session", bookTitle: title };
  }
  if (activity.type === "progress_logged") {
    const page = Number(activity.details.page_number ?? 0);
    return { label: page > 0 ? `Logged progress to page ${page}` : "Logged reading progress", bookTitle: title };
  }
  return { label: "Updated reading activity", bookTitle: title };
};

const ActivityIcon = ({ type }: { type?: string }) => {
  const Icon = type === "reading_session"
    ? APP_ICONS.dashboard.continueReading
    : type === "progress_logged"
      ? APP_ICONS.bookDetail.logProgress
      : APP_ICONS.dashboard.recentActivity;
  return <Icon className="h-4 w-4" aria-hidden="true" />;
};

const SectionHeader = ({
  id,
  title,
  subtitle,
  action,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <h2 id={id} className="font-display text-lg font-semibold md:text-xl">{title}</h2>
      {subtitle && <p className="font-sans text-sm text-muted-foreground">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

const BookCover = ({ book, className }: { book: BookType; className: string }) => {
  if (book.cover_url) {
    return (
      <img
        src={book.cover_url}
        alt=""
        aria-hidden="true"
        className={`${className} rounded-md border border-border/70 object-cover shadow-sm`}
        decoding="async"
        draggable={false}
      />
    );
  }
  return (
    <span className={`${className} flex items-center justify-center rounded-md border border-border/70 bg-primary/[0.1] text-primary`}>
      <APP_ICONS.dashboard.coverFallback className="h-8 w-8" aria-hidden="true" />
    </span>
  );
};

const getActivityTypeLabel = (type: DashboardBookCandidate["lastActivityType"]) => {
  switch (type) {
    case "progress_log": return "Progress logged";
    case "reading_session": return "Read";
    case "date_started": return "Started";
    case "created": return "Added";
    default: return "Updated";
  }
};

const formatTimeAgo = (timestamp: string) => {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime())
    ? "recently"
    : formatDistanceToNow(parsed, { addSuffix: true });
};

const toTelemetryFreshness = (
  freshness: DashboardJourneyFreshness,
  provisional: boolean,
) => {
  if (provisional) return "provisional";
  return freshness === "not_requested" ? undefined : freshness;
};

const toTelemetryQuestMetric = (metric: string) => {
  const aliases: Record<string, string> = {
    minutes_read: "reading_minutes",
    reading_sessions: "sessions",
    reading_velocity: "velocity",
  };
  const normalized = aliases[metric] ?? metric;
  return [
    "reading_minutes",
    "pages_read",
    "reading_days",
    "sessions",
    "books_completed",
    "velocity",
    "series_books_completed",
  ].includes(normalized) ? normalized : null;
};

export default Dashboard;
