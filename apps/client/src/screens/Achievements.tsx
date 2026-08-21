import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { NativeHeader } from "@/components/NativeHeader";
import { NativeScrollView } from "@/components/NativeScrollView";
import LoadingSpinner from "@/components/LoadingSpinner";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { BadgeDetailsDialog } from "@/components/BadgeDetailsDialog";
import { JourneyBadges } from "@/components/journey/JourneyBadges";
import { JourneyFreshnessNotice } from "@/components/journey/JourneyFreshnessNotice";
import { JourneyLeague } from "@/components/journey/JourneyLeague";
import { JourneyOverview } from "@/components/journey/JourneyOverview";
import {
  JourneyQuestBookPicker,
  JourneyQuests,
} from "@/components/journey/JourneyQuests";
import { JourneyShop } from "@/components/journey/JourneyShop";
import {
  JourneyTabsRail,
} from "@/components/journey/JourneyTabsRail";
import { useAuth } from "@/hooks/useAuth";
import { useBadges } from "@/hooks/useBadges";
import { useBooks } from "@/hooks/useBooks";
import {
  gamificationQueryKey,
  useGamification,
  useLeaderboard,
} from "@/hooks/useGamification";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useTimer } from "@/contexts/TimerContext";
import {
  isGamificationFallbackEligible,
  updateGamificationSettings,
  type LeaderboardScope,
  type QuestAssignment,
} from "@/services/api/gamification";
import { trackCoreEvent } from "@/services/telemetry";
import {
  JOURNEY_TAB_VALUES,
  getJourneyEntryTelemetrySource,
  getQuestAction,
  selectDailyFocus,
  type JourneyTabValue,
} from "@/lib/journey";
import { invalidateDashboardHomeQueries } from "@/lib/dashboardQueries";
import type { Badge as BadgeType, Book, UserBadge } from "@/types";
import { toast } from "sonner";

const TRACKABLE_QUEST_METRICS = new Set([
  "reading_minutes",
  "pages_read",
  "reading_days",
  "sessions",
  "books_completed",
  "velocity",
  "series_books_completed",
]);

const Achievements = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { leaderboardsEnabled } = useFeatureFlags();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const normalizedTab: JourneyTabValue = requestedTab
    && JOURNEY_TAB_VALUES.has(requestedTab as JourneyTabValue)
    ? requestedTab as JourneyTabValue
    : "overview";
  const shouldLoadBadges = normalizedTab === "badges";
  const shouldLoadBooks = normalizedTab === "overview" || normalizedTab === "quests";
  const { badges, earnedBadges, loading: badgesLoading } = useBadges(
    user?.id,
    shouldLoadBadges,
  );
  const { books, loading: booksLoading } = useBooks(user?.id, shouldLoadBooks);
  const { startTimer } = useTimer();
  const {
    data,
    isLoading,
    error,
    provisional,
    freshness,
    isFetching,
    refetch,
  } = useGamification(user?.id);
  const [scope, setScope] = useState<LeaderboardScope>("league");
  const leaderboard = useLeaderboard(
    user?.id,
    scope,
    data?.week.id,
    normalizedTab === "rankings"
      && leaderboardsEnabled
      && Boolean(data?.account.leaderboard_opt_in),
  );
  const [selectedBadge, setSelectedBadge] = useState<BadgeType | null>(null);
  const [selectedEarnedBadge, setSelectedEarnedBadge] = useState<UserBadge>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [savingOptIn, setSavingOptIn] = useState(false);
  const [questPicker, setQuestPicker] = useState<"timer" | "progress" | null>(null);
  const openedTrackedRef = useRef(false);
  const lastTrackedTabRef = useRef<JourneyTabValue | null>(null);
  const entryTelemetrySourceRef = useRef(
    getJourneyEntryTelemetrySource(location.state, Boolean(requestedTab)),
  );

  useEffect(() => {
    if (!user || !data) return;
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const key = `brack:gamification-timezone:${user.id}`;
    let savedTimezone: string | null = null;
    try {
      savedTimezone = localStorage.getItem(key);
    } catch {
      // Timezone synchronization can continue without device storage.
    }
    if (!detectedTimezone
      || detectedTimezone === data.timezone
      || savedTimezone === detectedTimezone) {
      return;
    }
    try {
      localStorage.setItem(key, detectedTimezone);
    } catch {
      // The server update remains authoritative in restricted storage contexts.
    }
    void updateGamificationSettings({ timezone: detectedTimezone })
      .then(() => Promise.all([
        queryClient.invalidateQueries({ queryKey: gamificationQueryKey(user.id) }),
        invalidateDashboardHomeQueries(queryClient, user.id),
      ]))
      .catch(() => {
        try {
          localStorage.removeItem(key);
        } catch {
          // No persisted attempt marker to clear.
        }
      });
  }, [data, queryClient, user]);

  useEffect(() => {
    if (!user || !data || openedTrackedRef.current) return;
    openedTrackedRef.current = true;
    trackCoreEvent("journey_opened", {
      source: entryTelemetrySourceRef.current,
      freshness: provisional ? "provisional" : freshness,
    });
  }, [data, freshness, provisional, user]);

  useEffect(() => {
    if (!user || !data || lastTrackedTabRef.current === normalizedTab) return;
    const isInitialTab = lastTrackedTabRef.current === null;
    lastTrackedTabRef.current = normalizedTab;
    trackCoreEvent("journey_tab_viewed", {
      source: isInitialTab ? entryTelemetrySourceRef.current : "journey",
      destination_tab: normalizedTab,
      freshness: provisional ? "provisional" : freshness,
    });
    if (isInitialTab && entryTelemetrySourceRef.current === "dashboard_hud") {
      navigate(
        {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
        { replace: true, state: null },
      );
    }
  }, [
    data,
    freshness,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    normalizedTab,
    provisional,
    user,
  ]);

  const dailyQuests = data?.quests.filter((quest) => quest.cadence === "daily") ?? [];
  const weeklyQuests = data?.quests.filter((quest) => quest.cadence === "weekly") ?? [];
  const dailyFocus = useMemo(
    () => freshness === "expired" ? null : selectDailyFocus(data?.quests ?? []),
    [data?.quests, freshness],
  );
  const readingBooks = useMemo(
    () => books.filter((book) => book.status === "reading"),
    [books],
  );
  const retainedRetryableSnapshot = Boolean(
    data && error && isGamificationFallbackEligible(error),
  );

  if (!user) return null;

  const setJourneyTab = (value: JourneyTabValue) => {
    setSearchParams(value === "overview" ? {} : { tab: value }, { replace: true });
  };

  const handleBadgeClick = (badge: BadgeType, earned?: UserBadge) => {
    setSelectedBadge(badge);
    setSelectedEarnedBadge(earned);
    setDetailsOpen(true);
  };

  const handleLeaderboardOptIn = async (checked: boolean) => {
    setSavingOptIn(true);
    try {
      await updateGamificationSettings({ leaderboard_opt_in: checked });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: gamificationQueryKey(user.id) }),
        queryClient.invalidateQueries({ queryKey: ["reader-leaderboard", user.id] }),
        invalidateDashboardHomeQueries(queryClient, user.id),
      ]);
      toast.success(
        checked
          ? "Reader League participation starts next week"
          : "Reader Leagues disabled",
      );
    } catch {
      toast.error("Could not update Reader League participation");
    } finally {
      setSavingOptIn(false);
    }
  };

  const completeQuestAction = (mode: "timer" | "progress", book: Book) => {
    if (mode === "timer") {
      startTimer(book.id, book.title);
      toast.success(`Reading timer started for ${book.title}`);
    } else {
      navigate(`/book/${book.id}/progress`);
    }
    setQuestPicker(null);
  };

  const handleQuestAction = (quest: QuestAssignment) => {
    if (normalizedTab === "overview"
      && quest.id === dailyFocus?.id
      && TRACKABLE_QUEST_METRICS.has(quest.metric)) {
      trackCoreEvent("daily_focus_started", {
        source: "journey_overview",
        quest_metric: quest.metric,
        freshness: provisional ? "provisional" : freshness,
      });
    }

    const action = getQuestAction(quest.metric);
    if (action === "library") {
      navigate("/my-books");
      return;
    }
    if (readingBooks.length === 0) {
      toast.info("Choose a book to begin this quest");
      navigate("/my-books");
      return;
    }
    if (readingBooks.length === 1) {
      completeQuestAction(action, readingBooks[0]);
      return;
    }
    setQuestPicker(action);
  };

  return (
    <MobileLayout>
      <Tabs
        value={normalizedTab}
        onValueChange={(value) => setJourneyTab(value as JourneyTabValue)}
        asChild
      >
        <div className="contents">
          {isMobile ? (
            <MobileHeader
              title="Reader Journey"
              secondary={data ? <JourneyTabsRail activeTab={normalizedTab} /> : undefined}
            />
          ) : (
            <NativeHeader
              title="Reader Journey"
              subtitle="Turn reading momentum into lasting progress"
              scrollContainerId="journey-scroll"
              secondary={data ? <JourneyTabsRail activeTab={normalizedTab} /> : undefined}
            />
          )}
          <NativeScrollView id="journey-scroll" className="app-page [container-type:inline-size]">
            {isLoading ? (
              <div className="flex min-h-[28rem] items-center justify-center">
                <LoadingSpinner size="lg" text="Preparing your Reader Journey..." />
              </div>
            ) : !data || (error && !retainedRetryableSnapshot) ? (
              <PremiumEmptyState
                asset="badConnection"
                title="Reader Journey is unavailable"
                description="Reconnect and try again. Your reading data remains safe."
                action={<Button className="min-h-11" onClick={() => void refetch()}>Try again</Button>}
              />
            ) : (
              <div className="space-y-5">
                <JourneyFreshnessNotice
                  freshness={freshness}
                  cachedAt={data.cached_at}
                  refreshing={isFetching}
                  onRefresh={() => void refetch()}
                />
                <TabsContent value="overview" className="focus-visible:outline-none">
                  <JourneyOverview
                    data={data}
                    dailyFocus={dailyFocus}
                    provisional={provisional}
                    leaderboardsEnabled={leaderboardsEnabled}
                    savingOptIn={savingOptIn}
                    actionLoading={booksLoading}
                    currentCycleAvailable={freshness !== "expired"}
                    onQuestAction={handleQuestAction}
                    onJoinLeague={() => void handleLeaderboardOptIn(true)}
                    onOpenTab={setJourneyTab}
                  />
                </TabsContent>

                <TabsContent value="quests" className="focus-visible:outline-none">
                  {freshness === "expired" ? (
                    <PremiumEmptyState
                      asset="badConnection"
                      title="Refresh to see current quests"
                      description="Saved level and wallet balances remain available on Overview."
                      size="compact"
                      action={<Button className="min-h-11" onClick={() => void refetch()}>Refresh quests</Button>}
                    />
                  ) : (
                    <JourneyQuests
                      dailyQuests={dailyQuests}
                      weeklyQuests={weeklyQuests}
                      tomorrowQuests={data.tomorrow_quests}
                      serverTime={data.server_time}
                      timezone={data.timezone}
                      receivedAt={data.cached_at}
                      collapseWeekly={isMobile}
                      onAction={handleQuestAction}
                      actionLoading={booksLoading}
                    />
                  )}
                </TabsContent>

                <TabsContent value="shop" className="focus-visible:outline-none">
                  <JourneyShop userId={user.id} />
                </TabsContent>

                <TabsContent value="badges" className="focus-visible:outline-none">
                  <JourneyBadges
                    badges={badges}
                    earnedBadges={earnedBadges}
                    loading={badgesLoading}
                    onBadgeClick={handleBadgeClick}
                  />
                </TabsContent>

                <TabsContent value="rankings" className="focus-visible:outline-none">
                  {freshness === "expired" ? (
                    <PremiumEmptyState
                      asset="badConnection"
                      title="Refresh to see current standings"
                      description="Reader League periods may have changed since this Journey was saved."
                      size="compact"
                      action={<Button className="min-h-11" onClick={() => void refetch()}>Refresh League</Button>}
                    />
                  ) : (
                    <JourneyLeague
                      enabled={leaderboardsEnabled}
                      account={data.account}
                      league={data.league}
                      cutoff={data.week.scoring_closes_at}
                      serverTime={data.server_time}
                      receivedAt={data.cached_at}
                      scope={scope}
                      mobile={isMobile}
                      savingOptIn={savingOptIn}
                      loading={leaderboard.isLoading}
                      refreshing={leaderboard.isFetching && Boolean(leaderboard.data)}
                      cached={leaderboard.data?.source === "cached"}
                      error={leaderboard.error}
                      entries={leaderboard.data?.entries ?? []}
                      onScopeChange={setScope}
                      onOptInChange={handleLeaderboardOptIn}
                      onRetry={() => void leaderboard.refetch()}
                    />
                  )}
                </TabsContent>
              </div>
            )}
          </NativeScrollView>
        </div>
      </Tabs>

      <JourneyQuestBookPicker
        mode={questPicker}
        books={readingBooks}
        onOpenChange={(open) => { if (!open) setQuestPicker(null); }}
        onSelect={completeQuestAction}
      />

      {selectedBadge && (
        <BadgeDetailsDialog
          badge={selectedBadge}
          earnedBadge={selectedEarnedBadge}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}
    </MobileLayout>
  );
};

export default Achievements;
