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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CurrencyIcon, type BrackCurrency } from "@/components/CurrencyIcon";
import { useAuth } from "@/hooks/useAuth";
import { useBadges } from "@/hooks/useBadges";
import {
  useGamification,
  useGamificationShop,
  useLeaderboard,
} from "@/hooks/useGamification";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { APP_ICONS } from "@/config/iconography";
import {
  gamificationQueryKey,
} from "@/hooks/useGamification";
import {
  GAMIFICATION_SHOP_ITEM_CODES,
  updateGamificationSettings,
  type GamificationShopItem,
  type LeaderboardScope,
  type QuestAssignment,
} from "@/services/api/gamification";
import type { Badge as BadgeType, UserBadge } from "@/types";
import { toast } from "sonner";

const JOURNEY_TABS = new Set(["overview", "quests", "shop", "badges", "rankings"]);

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
  const normalizedTab = requestedTab && JOURNEY_TABS.has(requestedTab)
    ? requestedTab
    : "overview";
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
            value={normalizedTab}
            onValueChange={(value) => {
              setSearchParams(value === "overview" ? {} : { tab: value }, { replace: true });
            }}
            className="space-y-5"
          >
            <TabsList className="grid h-auto w-full grid-cols-5">
              <JourneyTab value="overview" icon={APP_ICONS.journey.overview} label="Overview" />
              <JourneyTab value="quests" icon={APP_ICONS.journey.quests} label="Quests" />
              <TabsTrigger value="shop" className="gap-2 px-2">
                <CurrencyIcon currency="goldLeaves" />
                <span className="hidden sm:inline">Shop</span>
              </TabsTrigger>
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
                        <span className="inline-flex items-center gap-1">
                          <CurrencyIcon currency="ink" />
                          {data.account.lifetime_ink.toLocaleString()} Ink
                        </span>
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
                        currency="ink"
                        value={data.account.lifetime_ink.toLocaleString()}
                        label="Lifetime Ink"
                      />
                      <JourneyMetric
                        currency="goldLeaves"
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
                          <strong className="inline-flex items-center gap-1 text-2xl">
                            <CurrencyIcon currency="ink" size="md" />
                            {data.league.score.toLocaleString()}
                          </strong>
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
                            {reward.ink_delta > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <CurrencyIcon currency="ink" />
                                +{reward.ink_delta} Ink
                              </span>
                            )}
                            {reward.gold_leaves_delta > 0 && (
                              <span className="ml-2 inline-flex items-center gap-1 text-primary">
                                <CurrencyIcon currency="goldLeaves" />
                                +{reward.gold_leaves_delta} Gold
                              </span>
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

            <TabsContent value="shop" className="space-y-5">
              <ShopSection userId={user.id} />
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
  currency,
  value,
  label,
}: {
  currency: BrackCurrency;
  value: string;
  label: string;
}) => (
  <div className="rounded-md border border-border/70 p-3">
    <div className="flex items-center gap-2 text-muted-foreground">
      <CurrencyIcon currency={currency} size="md" />
      <span className="text-xs">{label}</span>
    </div>
    <p className="mt-2 text-2xl font-bold">{value}</p>
  </div>
);

const createPurchaseIdempotencyKey = () =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `shop-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const ShopSection = ({ userId }: { userId: string }) => {
  const shop = useGamificationShop(userId);
  const [purchaseTarget, setPurchaseTarget] = useState<{
    item: GamificationShopItem;
    idempotencyKey: string;
  } | null>(null);

  const handlePurchase = async () => {
    if (!purchaseTarget) return;
    const { item, idempotencyKey } = purchaseTarget;

    try {
      const result = await shop.purchaseMutation.mutateAsync({
        itemCode: item.code,
        idempotencyKey,
      });
      setPurchaseTarget(null);
      toast.success(
        result.idempotent
          ? `${item.display_name} was already added`
          : `${item.display_name} added to your inventory`,
      );
    } catch {
      toast.error("Purchase did not complete. Your Gold Leaves were not spent.");
    }
  };

  if (shop.isLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <LoadingSpinner text="Opening the Gold Leaf shop..." />
      </div>
    );
  }

  if (shop.error || !shop.data) {
    return (
      <PremiumEmptyState
        asset="badConnection"
        title="The Gold Leaf shop is unavailable"
        description="Reconnect and try again. Your balance and inventory remain safe."
        action={<Button onClick={() => void shop.refetch()}>Try again</Button>}
        size="compact"
      />
    );
  }

  const { account, items } = shop.data;

  return (
    <>
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div>
            <CardTitle className="text-lg">Gold Leaf shop</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Spend rare Gold Leaves on useful reading safeguards. Lifetime Ink is never spent.
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 font-semibold text-primary">
            <CurrencyIcon currency="goldLeaves" size="md" />
            {account.gold_leaves.toLocaleString()} Gold {account.gold_leaves === 1 ? "Leaf" : "Leaves"}
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">
              No shop items are available right now.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((item) => {
                const inventoryFull =
                  item.max_inventory > 0 && item.quantity >= item.max_inventory;
                const canAfford = account.gold_leaves >= item.gold_leaves_cost;
                const purchasingThisItem =
                  shop.purchaseMutation.isPending
                  && shop.purchaseMutation.variables?.itemCode === item.code;
                const isStreakFreeze = item.code === GAMIFICATION_SHOP_ITEM_CODES.streakFreeze;

                return (
                  <div
                    key={item.code}
                    className="flex flex-col gap-4 rounded-md border border-border/70 bg-background/50 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {isStreakFreeze ? (
                        <APP_ICONS.stats.useFreeze className="h-6 w-6" />
                      ) : (
                        <CurrencyIcon currency="goldLeaves" size="lg" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium">{item.display_name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <Badge variant="secondary">
                          {item.quantity} / {item.max_inventory} owned
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                          <CurrencyIcon currency="goldLeaves" />
                          {item.gold_leaves_cost.toLocaleString()} Gold {item.gold_leaves_cost === 1 ? "Leaf" : "Leaves"}
                        </span>
                        <Button
                          size="sm"
                          disabled={
                            shop.purchaseMutation.isPending
                            || !item.can_purchase
                            || inventoryFull
                            || !canAfford
                          }
                          onClick={() => setPurchaseTarget({
                            item,
                            idempotencyKey: createPurchaseIdempotencyKey(),
                          })}
                        >
                          {purchasingThisItem
                            ? "Buying..."
                            : inventoryFull
                              ? "Inventory full"
                              : !canAfford
                                ? "Not enough Leaves"
                                : item.can_purchase
                                  ? "Buy"
                                  : "Unavailable"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(purchaseTarget)}
        onOpenChange={(open) => {
          if (!open && !shop.purchaseMutation.isPending) setPurchaseTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buy {purchaseTarget?.item.display_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will spend {purchaseTarget?.item.gold_leaves_cost.toLocaleString()} Gold {purchaseTarget?.item.gold_leaves_cost === 1 ? "Leaf" : "Leaves"}. Your Lifetime Ink and level will not change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={shop.purchaseMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              disabled={shop.purchaseMutation.isPending}
              onClick={() => void handlePurchase()}
            >
              {shop.purchaseMutation.isPending ? "Purchasing..." : "Confirm purchase"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

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
          <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <CurrencyIcon currency="ink" size="xs" />
              {quest.reward_ink} Ink
            </span>
            {quest.reward_gold_leaves > 0 && (
              <span className="inline-flex items-center gap-1 text-primary">
                + <CurrencyIcon currency="goldLeaves" size="xs" />
                {quest.reward_gold_leaves} Gold {quest.reward_gold_leaves === 1 ? "Leaf" : "Leaves"}
              </span>
            )}
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
              <strong className="inline-flex items-center gap-1">
                <CurrencyIcon currency="ink" />
                {entry.competitive_ink.toLocaleString()} Ink
              </strong>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);

export default Achievements;
