import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { NativeHeader } from "@/components/NativeHeader";
import { NativeScrollView } from "@/components/NativeScrollView";
import LoadingSpinner from "@/components/LoadingSpinner";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { BadgeDetailsDialog } from "@/components/BadgeDetailsDialog";
import { AppIcon } from "@/components/ui/app-icon";
import { useAuth } from "@/hooks/useAuth";
import { useBadges } from "@/hooks/useBadges";
import { useGamification, useLeaderboard } from "@/hooks/useGamification";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { APP_ICONS } from "@/config/iconography";
import {
  gamificationQueryKey,
} from "@/hooks/useGamification";
import {
  updateGamificationSettings,
  type LeaderboardScope,
  type QuestAssignment,
} from "@/services/api/gamification";
import type { Badge as BadgeType, UserBadge } from "@/types";
import { toast } from "sonner";

const Achievements = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { leaderboardsEnabled } = useFeatureFlags();
  const { badges, earnedBadges, loading: badgesLoading } = useBadges(user?.id);
  const {
    data,
    isLoading,
    error,
    levelProgress,
    provisional,
  } = useGamification(user?.id);
  const [scope, setScope] = useState<LeaderboardScope>("league");
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    requestedTab && ["overview", "quests", "badges", "rankings"].includes(requestedTab)
      ? requestedTab
      : "overview",
  );
  const leaderboard = useLeaderboard(
    user?.id,
    scope,
    data?.week.id,
    leaderboardsEnabled && Boolean(data?.account.leaderboard_opt_in),
  );
  const [selectedBadge, setSelectedBadge] = useState<BadgeType | null>(null);
  const [selectedEarnedBadge, setSelectedEarnedBadge] = useState<UserBadge>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [savingOptIn, setSavingOptIn] = useState(false);

  useEffect(() => {
    if (!user || !data) return;
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const key = `brack:gamification-timezone:${user.id}`;
    if (!detectedTimezone || detectedTimezone === data.timezone || localStorage.getItem(key) === detectedTimezone) {
      return;
    }
    localStorage.setItem(key, detectedTimezone);
    void updateGamificationSettings({ timezone: detectedTimezone })
      .then(() => queryClient.invalidateQueries({ queryKey: gamificationQueryKey(user.id) }))
      .catch(() => localStorage.removeItem(key));
  }, [data, queryClient, user]);

  const dailyQuests = data?.quests.filter((quest) => quest.cadence === "daily") ?? [];
  const weeklyQuests = data?.quests.filter((quest) => quest.cadence === "weekly") ?? [];

  if (!user) return null;

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

  return (
    <MobileLayout>
      {isMobile ? (
        <MobileHeader title="Reader Journey" />
      ) : (
        <NativeHeader
          title="Reader Journey"
          subtitle="Ink, quests, badges, and weekly Reader Leagues"
          scrollContainerId="journey-scroll"
        />
      )}
      <NativeScrollView id="journey-scroll" className="app-page space-y-5">
        {isLoading ? (
          <div className="flex min-h-[28rem] items-center justify-center">
            <LoadingSpinner size="lg" text="Preparing your Reader Journey..." />
          </div>
        ) : error || !data ? (
          <PremiumEmptyState
            asset="badConnection"
            title="Reader Journey is unavailable"
            description="Reconnect and try again. Your reading data remains safe."
          />
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value);
              setSearchParams(value === "overview" ? {} : { tab: value }, { replace: true });
            }}
            className="space-y-5"
          >
            <TabsList className="grid h-auto w-full grid-cols-4">
              <JourneyTab value="overview" icon={APP_ICONS.journey.overview} label="Overview" />
              <JourneyTab value="quests" icon={APP_ICONS.journey.quests} label="Quests" />
              <JourneyTab value="badges" icon={APP_ICONS.journey.badges} label="Badges" />
              <JourneyTab value="rankings" icon={APP_ICONS.journey.rankings} label="Ranks" />
            </TabsList>

            <TabsContent value="overview" className="space-y-5">
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
                <Card>
                  <CardContent className="space-y-5 p-5 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Level {data.account.current_level}</p>
                        <h2 className="font-display text-3xl font-bold">{data.account.level_title}</h2>
                      </div>
                      {provisional && (
                        <Badge variant="secondary">Offline progress pending</Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{data.account.lifetime_ink.toLocaleString()} Ink</span>
                        <span className="text-muted-foreground">
                          {data.account.next_level
                            ? `${data.account.next_level.ink_threshold.toLocaleString()} next level`
                            : "Highest configured level"}
                        </span>
                      </div>
                      <Progress value={levelProgress} className="h-2.5" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <JourneyMetric
                        icon={APP_ICONS.journey.ink}
                        value={data.account.lifetime_ink.toLocaleString()}
                        label="Lifetime Ink"
                      />
                      <JourneyMetric
                        icon={APP_ICONS.journey.goldLeaf}
                        value={data.account.gold_leaves.toLocaleString()}
                        label="Gold Leaves"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">This week</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {data.league ? (
                      <>
                        <div>
                          <p className="font-display text-xl font-semibold">{data.league.name}</p>
                          <p className="text-sm text-muted-foreground">
                            #{data.league.provisional_rank} of {data.league.member_count}
                          </p>
                        </div>
                        <div className="flex items-end justify-between">
                          <span className="text-sm text-muted-foreground">Competitive Ink</span>
                          <strong className="text-2xl">{data.league.score}</strong>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Join an approximately 50-reader league. Lifetime Ink and quests work without joining.
                        </p>
                        {leaderboardsEnabled && (
                          <Button
                            onClick={() => handleLeaderboardOptIn(true)}
                            disabled={savingOptIn}
                          >
                            Join Reader Leagues
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <QuestGroup title="Today's quests" quests={dailyQuests} compact />
                <QuestGroup title="Weekly quests" quests={weeklyQuests} compact />
              </section>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Ink</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.recent_rewards.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Your first qualifying reading activity will appear here.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/70">
                      {data.recent_rewards.slice(0, 8).map((reward) => (
                        <div key={reward.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{reward.display_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(reward.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="shrink-0 text-right text-sm font-semibold">
                            {reward.ink_delta > 0 && <span>+{reward.ink_delta} Ink</span>}
                            {reward.gold_leaves_delta > 0 && (
                              <span className="ml-2 text-primary">+{reward.gold_leaves_delta} Gold</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quests" className="space-y-5">
              <QuestGroup title="Daily quests" quests={dailyQuests} />
              <QuestGroup title="Weekly quests" quests={weeklyQuests} />
              {data.tomorrow_quests.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Tomorrow's preview</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    {data.tomorrow_quests.map((quest) => (
                      <div key={quest.id} className="rounded-md border border-border/70 p-3">
                        <p className="font-medium">{quest.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{quest.description}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="badges" className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold">Badges</h2>
                  <p className="text-sm text-muted-foreground">
                    {earnedBadges.length} of {badges.length} unlocked
                  </p>
                </div>
              </div>
              {badgesLoading ? (
                <div className="flex min-h-72 items-center justify-center">
                  <LoadingSpinner text="Loading badges..." />
                </div>
              ) : badges.length === 0 ? (
                <PremiumEmptyState
                  asset="emptyGoals"
                  title="No badges configured"
                  description="Badge milestones will appear here when available."
                  size="compact"
                />
              ) : (
                <BadgeDisplay
                  badges={badges}
                  earnedBadges={earnedBadges}
                  onBadgeClick={handleBadgeClick}
                />
              )}
            </TabsContent>

            <TabsContent value="rankings" className="space-y-5">
              {!leaderboardsEnabled ? (
                <PremiumEmptyState
                  asset="emptyReaders"
                  title="Reader Leagues are paused"
                  description="Your Ink, levels, and quests continue to work."
                />
              ) : !data.account.leaderboard_opt_in ? (
                <Card>
                  <CardContent className="space-y-4 p-6">
                    <h2 className="font-display text-2xl font-bold">Join Reader Leagues</h2>
                    <p className="max-w-2xl text-muted-foreground">
                      Compete using qualifying reading activity and quests. Rankings are optional and begin with the next weekly cycle.
                    </p>
                    <Button
                      onClick={() => handleLeaderboardOptIn(true)}
                      disabled={savingOptIn}
                    >
                      Join Reader Leagues
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">Reader League participation</p>
                        <p className="text-sm text-muted-foreground">
                          {data.league
                            ? "Current rankings are provisional until the weekly grace period closes."
                            : data.account.leaderboard_eligible_from
                              ? `Your first league begins the week of ${new Date(
                                  `${data.account.leaderboard_eligible_from}T00:00:00`,
                                ).toLocaleDateString()}.`
                              : "Your Reader League assignment is pending."}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm">Participating</span>
                        <Switch
                          checked={data.account.leaderboard_opt_in}
                          disabled={savingOptIn}
                          onCheckedChange={handleLeaderboardOptIn}
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <Tabs value={scope} onValueChange={(value) => setScope(value as LeaderboardScope)}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="league">League</TabsTrigger>
                      <TabsTrigger value="friends">Friends</TabsTrigger>
                      <TabsTrigger value="global">Global Top 100</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <LeaderboardTable
                    loading={leaderboard.isLoading}
                    entries={leaderboard.data?.entries ?? []}
                  />
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </NativeScrollView>

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

const JourneyTab = ({
  value,
  icon,
  label,
}: {
  value: string;
  icon: typeof APP_ICONS.journey.overview;
  label: string;
}) => (
  <TabsTrigger value={value} className="gap-2 px-2">
    <AppIcon icon={icon} variant="inline" />
    <span className="hidden sm:inline">{label}</span>
  </TabsTrigger>
);

const JourneyMetric = ({
  icon,
  value,
  label,
}: {
  icon: typeof APP_ICONS.journey.ink;
  value: string;
  label: string;
}) => (
  <div className="rounded-md border border-border/70 p-3">
    <div className="flex items-center gap-2 text-muted-foreground">
      <AppIcon icon={icon} variant="inline" />
      <span className="text-xs">{label}</span>
    </div>
    <p className="mt-2 text-2xl font-bold">{value}</p>
  </div>
);

const QuestGroup = ({
  title,
  quests,
  compact = false,
}: {
  title: string;
  quests: QuestAssignment[];
  compact?: boolean;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent className={compact ? "space-y-3" : "grid gap-3 md:grid-cols-3"}>
      {quests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No quests available for this period.</p>
      ) : (
        quests.map((quest) => <QuestCard key={quest.id} quest={quest} />)
      )}
    </CardContent>
  </Card>
);

const QuestCard = ({ quest }: { quest: QuestAssignment }) => {
  const percentage = Math.min(100, (quest.progress_value / quest.target_value) * 100);
  return (
    <div className="space-y-3 rounded-md border border-border/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{quest.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{quest.description}</p>
        </div>
        {quest.status === "completed" && <Badge>Done</Badge>}
      </div>
      <div className="space-y-1.5">
        <Progress value={percentage} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.min(quest.progress_value, quest.target_value)} / {quest.target_value}</span>
          <span>
            {quest.reward_ink} Ink
            {quest.reward_gold_leaves > 0 ? ` + ${quest.reward_gold_leaves} Gold Leaf` : ""}
          </span>
        </div>
      </div>
    </div>
  );
};

const LeaderboardTable = ({
  loading,
  entries,
}: {
  loading: boolean;
  entries: Array<{
    user_id: string;
    rank: number;
    display_name: string;
    avatar_url: string | null;
    competitive_ink: number;
    level_title: string | null;
    is_current_user: boolean;
  }>;
}) => (
  <Card>
    <CardContent className="p-0">
      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <LoadingSpinner text="Loading rankings..." />
        </div>
      ) : entries.length === 0 ? (
        <PremiumEmptyState
          asset="emptyReaders"
          title="No ranked readers yet"
          description="Qualifying activity will populate this ranking."
          size="compact"
        />
      ) : (
        <div className="divide-y divide-border/70">
          {entries.map((entry) => (
            <div
              key={entry.user_id}
              className={`grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 p-3 ${
                entry.is_current_user ? "bg-primary/8" : ""
              }`}
            >
              <strong className="text-center">#{entry.rank}</strong>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={entry.avatar_url || undefined} />
                  <AvatarFallback>{entry.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{entry.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.level_title || "Fresh Ink"}
                  </p>
                </div>
              </div>
              <strong>{entry.competitive_ink} Ink</strong>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export default Achievements;
