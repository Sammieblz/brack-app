import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { NavArrowRight, Plus } from "iconoir-react";
import { ProgressLogger } from "@/components/ProgressLogger";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useBadges } from "@/hooks/useBadges";
import { useStreaks } from "@/hooks/useStreaks";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { useChartData } from "@/hooks/useChartData";
import { ReadingHeatmap } from "@/components/charts/ReadingHeatmap";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Book as BookType, Goal } from "@/types";
import { DashboardCardSkeleton } from "@/components/skeletons/DashboardCardSkeleton";
import { ActivityItemSkeleton } from "@/components/skeletons/ActivityItemSkeleton";
import { PullToRefresh } from "@/components/PullToRefresh";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { GoalsSheet } from "@/components/GoalsSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { SwipeableBookListsCarousel } from "@/components/SwipeableBookListsCarousel";
import { NativeHeader } from "@/components/NativeHeader";
import { NativeScrollView } from "@/components/NativeScrollView";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useSupabaseRequest } from "@/hooks/useSupabaseRequest";
import { ReadingStatsWidget } from "@/components/ReadingStatsWidget";
import {
  BRACK_GOALS_IMAGE,
  BRACK_STREAK_HAPPY_IMAGE,
  BRACK_STREAK_SAD_IMAGE,
  BRACK_TROPHY_IMAGE,
} from "@/config/brackAssets";
import { APP_ICONS } from "@/config/iconography";
import {
  type DashboardBookCandidate,
  useDashboardHomeData,
} from "@/hooks/useDashboardHomeData";
import type { DayActivity, StreakData } from "@/utils/streakCalculation";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const { books, loading: booksLoading, refetchBooks } = useBooks(user?.id);
  const { badges, earnedBadges, loading: badgesLoading, checkAndAwardBadges } = useBadges(user?.id);
  const { streakData, activityCalendar, refetchStreaks, useStreakFreeze } = useStreaks(user?.id);
  const {
    activities,
    loading: activitiesLoading,
    formatTimeAgo,
    refetchActivity,
  } = useRecentActivity(user?.id);
  const { heatmapData, loading: chartLoading } = useChartData(user?.id);
  const {
    primaryBook,
    secondaryBooks,
    loading: dashboardHomeLoading,
    error: dashboardHomeError,
    refetch: refetchDashboardHome,
  } = useDashboardHomeData(user?.id);
  const { profile } = useProfileContext();
  const { withRetry } = useSupabaseRequest();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [progressBook, setProgressBook] = useState<BookType | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      loadGoalData();
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && books.length > 0) {
      checkBadges();
    }
  }, [books, user]);

  const checkBadges = async () => {
    if (!user) return;

    try {
      const { data: sessions } = await withRetry(
        () => supabase
          .from("reading_sessions")
          .select("*")
          .eq("user_id", user.id),
        { toastOnError: true, toastMessage: "Unable to load reading sessions" }
      );

      await checkAndAwardBadges(books, sessions || []);
    } catch (error) {
      console.error("Error checking badges:", error);
    }
  };

  const loadGoalData = async () => {
    if (!user) return;

    try {
      const { data, error } = await withRetry(
        () => supabase
          .from("goals")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .maybeSingle(),
        { toastOnError: true, toastMessage: "Failed to load goal data" }
      );

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setGoal(data);
    } catch (error: unknown) {
      console.error("Error loading goal:", error);
      toast.error("Failed to load goal data");
    }
  };

  const handleBookClick = (bookId: string) => {
    navigate(`/book/${bookId}`);
  };

  const handleProgressSuccess = async () => {
    setProgressBook(null);
    await Promise.all([
      refetchBooks(),
      refetchDashboardHome(),
      refetchStreaks(),
      refetchActivity(),
      loadGoalData(),
    ]);
  };

  const handleRefresh = async () => {
    await Promise.all([
      refetchBooks(),
      refetchDashboardHome(),
      refetchStreaks(),
      refetchActivity(),
      loadGoalData(),
    ]);
  };

  const completedBooksCount = useMemo(
    () => books.filter((book) => book.status === "completed").length,
    [books]
  );

  const goalTarget = goal?.target_books || 0;
  const progressPercentage = useMemo(
    () => goalTarget > 0
      ? Math.min(100, Math.round((completedBooksCount / goalTarget) * 100))
      : 0,
    [completedBooksCount, goalTarget]
  );

  const todayActivity = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return activityCalendar.find((activity) => activity.date === today) || null;
  }, [activityCalendar]);

  if (authLoading) {
    return (
      <MobileLayout showBottomNav={false}>
        <div className="flex h-96 items-center justify-center">
          <LoadingSpinner size="lg" text="Loading your reading journey..." />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        {isMobile ? (
          <MobileHeader title="Home" action={<GoalsSheet />} />
        ) : (
          <NativeHeader
            title="Welcome back!"
            subtitle="Pick up where you left off"
            action={<GoalsSheet />}
            scrollContainerId="dashboard-scroll"
            showUtilityActions
          />
        )}

        <NativeScrollView id="dashboard-scroll" className="app-page space-y-5 md:space-y-7">
          {isMobile && (
            <div>
              <h2 className="font-display text-xl font-bold">
                Welcome back{profile?.display_name ? `, ${profile.display_name}` : ""}!
              </h2>
              <p className="font-sans text-sm text-muted-foreground">
                Continue your current read first.
              </p>
            </div>
          )}

          <ContinueReadingSection
            loading={dashboardHomeLoading || booksLoading}
            error={dashboardHomeError}
            primaryBook={primaryBook}
            secondaryBooks={secondaryBooks}
            hasAnyBooks={books.length > 0}
            formatTimeAgo={formatTimeAgo}
            onAddBook={() => navigate("/add-book")}
            onBookClick={handleBookClick}
            onLogProgress={(book) => setProgressBook(book)}
            onViewLibrary={() => navigate("/my-books")}
          />

          <TodaySection
            goal={goal}
            completedBooksCount={completedBooksCount}
            goalProgress={progressPercentage}
            goalTarget={goalTarget}
            streakData={streakData}
            todayActivity={todayActivity}
            onManageGoals={() => navigate("/goals-management")}
            onUseFreeze={useStreakFreeze}
          />

          <section className="space-y-3">
            <SectionHeader
              title="Insights"
              subtitle="Stats and trends for deeper review"
              icon={<APP_ICONS.dashboard.insights className="h-5 w-5 text-primary" />}
            />
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
              {user && (
                <ReadingStatsWidget
                  userId={user.id}
                  books={books}
                  currentStreak={streakData.currentStreak}
                  displayName={profile?.display_name}
                />
              )}

              <div className="space-y-4">
                {!chartLoading && heatmapData.length > 0 && (
                  <ReadingHeatmap
                    data={heatmapData}
                    title="Reading Heatmap"
                    subtitle="Your recent reading activity"
                    weeks={10}
                    compact
                  />
                )}

                <AchievementsPreview
                  loading={badgesLoading}
                  badges={badges}
                  earnedBadges={earnedBadges}
                  onViewAll={() => navigate("/achievements")}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <SwipeableBookListsCarousel />
            <RecentActivityCard
              activities={activities}
              loading={activitiesLoading}
              formatTimeAgo={formatTimeAgo}
            />
          </section>
        </NativeScrollView>
      </PullToRefresh>

      {progressBook && (
        <ProgressLogger
          bookId={progressBook.id}
          bookTitle={progressBook.title}
          currentPage={progressBook.current_page || 0}
          open={Boolean(progressBook)}
          onOpenChange={(open) => {
            if (!open) setProgressBook(null);
          }}
          onSuccess={handleProgressSuccess}
        />
      )}

      {isMobile && <FloatingActionButton />}
    </MobileLayout>
  );
};

interface ContinueReadingSectionProps {
  loading: boolean;
  error: string | null;
  primaryBook: DashboardBookCandidate | null;
  secondaryBooks: DashboardBookCandidate[];
  hasAnyBooks: boolean;
  formatTimeAgo: (timestamp: string) => string;
  onAddBook: () => void;
  onBookClick: (bookId: string) => void;
  onLogProgress: (book: BookType) => void;
  onViewLibrary: () => void;
}

const ContinueReadingSection = ({
  loading,
  error,
  primaryBook,
  secondaryBooks,
  hasAnyBooks,
  formatTimeAgo,
  onAddBook,
  onBookClick,
  onLogProgress,
  onViewLibrary,
}: ContinueReadingSectionProps) => {
  const EmptyStateIcon = hasAnyBooks
    ? APP_ICONS.dashboard.emptyWithBooks
    : APP_ICONS.dashboard.emptyNoBooks;

  return (
    <section className="space-y-3">
      <SectionHeader
        title={primaryBook?.book.status === "to_read" ? "Pick Up a Book" : "Continue Reading"}
        subtitle="Your most recent reading activity appears first"
        icon={<APP_ICONS.dashboard.continueReading className="h-5 w-5 text-primary" />}
        action={
          hasAnyBooks ? (
            <Button variant="outline" size="sm" onClick={onViewLibrary}>
              Library
              <NavArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <DashboardCardSkeleton />
      ) : primaryBook ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <PrimaryContinueCard
            candidate={primaryBook}
            formatTimeAgo={formatTimeAgo}
            onBookClick={onBookClick}
            onLogProgress={onLogProgress}
          />

          {secondaryBooks.length > 0 && (
            <>
              <div className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-1">
                {secondaryBooks.map((candidate) => (
                  <SecondaryContinueCard
                    key={candidate.book.id}
                    candidate={candidate}
                    formatTimeAgo={formatTimeAgo}
                    onBookClick={onBookClick}
                  />
                ))}
              </div>

              <div className="flex gap-3 overflow-x-auto pb-1 md:hidden">
                {secondaryBooks.map((candidate) => (
                  <div key={candidate.book.id} className="w-[82vw] max-w-sm shrink-0">
                    <SecondaryContinueCard
                      candidate={candidate}
                      formatTimeAgo={formatTimeAgo}
                      onBookClick={onBookClick}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-5">
            <div className="grid gap-4 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary/10 text-primary">
                <EmptyStateIcon className="h-7 w-7" />
              </div>
              <div className="space-y-3">
                <div>
                  <h3 className="font-display text-lg font-semibold">
                    {hasAnyBooks ? "Choose your next read" : "Add your first book"}
                  </h3>
                  <p className="font-sans text-sm text-muted-foreground">
                    {hasAnyBooks
                      ? "Nothing is currently in progress. Pick a book from your library or add something new."
                      : "Start your library so Brack can build a useful home dashboard around your reading."}
                  </p>
                </div>
                {error && (
                  <p className="font-sans text-xs text-destructive">
                    Dashboard activity could not load: {error}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={hasAnyBooks ? onViewLibrary : onAddBook}>
                    {hasAnyBooks ? "Open Library" : "Add Book"}
                  </Button>
                  {hasAnyBooks && (
                    <Button variant="outline" onClick={onAddBook}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Book
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
};

interface ContinueCardProps {
  candidate: DashboardBookCandidate;
  formatTimeAgo: (timestamp: string) => string;
  onBookClick: (bookId: string) => void;
  onLogProgress?: (book: BookType) => void;
}

const PrimaryContinueCard = ({
  candidate,
  formatTimeAgo,
  onBookClick,
  onLogProgress,
}: ContinueCardProps) => {
  const { book } = candidate;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-[6rem_minmax(0,1fr)] lg:grid-cols-[8rem_minmax(0,1fr)]">
          <BookCover book={book} className="h-36 w-24 sm:h-40 sm:w-28 lg:h-48 lg:w-32" />

          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {book.status.replace("_", " ")}
                </Badge>
                <span className="font-sans text-xs text-muted-foreground">
                  {getActivityTypeLabel(candidate.lastActivityType)} {formatTimeAgo(candidate.lastActivityAt)}
                </span>
              </div>

              <div>
                <h3 className="font-display text-2xl font-bold leading-tight md:text-3xl">
                  {book.title}
                </h3>
                {book.author && (
                  <p className="font-serif text-sm text-muted-foreground md:text-base">
                    by {book.author}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between font-sans text-sm">
                <span className="text-muted-foreground">
                  {book.pages ? `${book.current_page || 0} / ${book.pages} pages` : "Progress"}
                </span>
                <span className="font-medium">{candidate.progressPercent}%</span>
              </div>
              <Progress value={candidate.progressPercent} className="h-2" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onBookClick(book.id)}>
                {candidate.ctaLabel}
                <NavArrowRight className="ml-2 h-4 w-4" />
              </Button>
              {onLogProgress && (
                <Button variant="outline" onClick={() => onLogProgress(book)}>
                  Log Progress
                </Button>
              )}
              <Button variant="ghost" onClick={() => onBookClick(book.id)}>
                View Details
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const SecondaryContinueCard = ({
  candidate,
  formatTimeAgo,
  onBookClick,
}: ContinueCardProps) => {
  const { book } = candidate;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/30"
      onClick={() => onBookClick(book.id)}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          <BookCover book={book} className="h-20 w-14" />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h4 className="font-serif text-sm font-semibold leading-snug line-clamp-2">
                {book.title}
              </h4>
              {book.author && (
                <p className="font-serif text-xs text-muted-foreground truncate">
                  by {book.author}
                </p>
              )}
            </div>
            <Progress value={candidate.progressPercent} className="h-1.5" />
            <p className="font-sans text-xs text-muted-foreground">
              {getActivityTypeLabel(candidate.lastActivityType)} {formatTimeAgo(candidate.lastActivityAt)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface TodaySectionProps {
  goal: Goal | null;
  completedBooksCount: number;
  goalProgress: number;
  goalTarget: number;
  streakData: StreakData;
  todayActivity: DayActivity | null;
  onManageGoals: () => void;
  onUseFreeze: () => Promise<boolean>;
}

const TodaySection = ({
  goal,
  completedBooksCount,
  goalProgress,
  goalTarget,
  streakData,
  todayActivity,
  onManageGoals,
  onUseFreeze,
}: TodaySectionProps) => {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Today"
        subtitle="Momentum, streak, and goal status"
        icon={<APP_ICONS.dashboard.today className="h-5 w-5 text-primary" />}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <GoalStatusCard
          goal={goal}
          completedBooksCount={completedBooksCount}
          goalProgress={goalProgress}
          goalTarget={goalTarget}
          onManageGoals={onManageGoals}
        />
        <StreakStatusCard
          streakData={streakData}
          todayActivity={todayActivity}
          onUseFreeze={onUseFreeze}
        />
      </div>
    </section>
  );
};

interface GoalStatusCardProps {
  goal: Goal | null;
  completedBooksCount: number;
  goalProgress: number;
  goalTarget: number;
  onManageGoals: () => void;
}

const GoalStatusCard = ({
  goal,
  completedBooksCount,
  goalProgress,
  goalTarget,
  onManageGoals,
}: GoalStatusCardProps) => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_6rem] sm:items-center">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <APP_ICONS.dashboard.goal className="h-5 w-5 text-primary" />
                <h3 className="font-display text-lg font-semibold">Reading Goal</h3>
              </div>
              <img
                src={BRACK_GOALS_IMAGE}
                alt=""
                aria-hidden="true"
                className="h-16 w-16 shrink-0 rounded-md border border-border/70 object-cover sm:hidden"
                draggable={false}
              />
            </div>

            {goal && goalTarget > 0 ? (
              <>
                <div className="flex items-center justify-between font-sans text-sm">
                  <span className="text-muted-foreground">
                    {completedBooksCount} / {goalTarget} books
                  </span>
                  <span className="font-medium">{goalProgress}%</span>
                </div>
                <Progress value={goalProgress} className="h-2" />
                <Button variant="outline" size="sm" onClick={onManageGoals}>
                  Manage goals
                </Button>
              </>
            ) : (
              <>
                <p className="font-sans text-sm text-muted-foreground">
                  Add a goal so your home page can track meaningful progress.
                </p>
                <Button size="sm" onClick={onManageGoals}>
                  Set Goal
                </Button>
              </>
            )}
          </div>

          <img
            src={BRACK_GOALS_IMAGE}
            alt=""
            aria-hidden="true"
            className="hidden h-24 w-24 rounded-md border border-border/70 object-cover sm:block"
            draggable={false}
          />
        </div>
      </CardContent>
    </Card>
  );
};

interface StreakStatusCardProps {
  streakData: StreakData;
  todayActivity: DayActivity | null;
  onUseFreeze: () => Promise<boolean>;
}

const StreakStatusCard = ({
  streakData,
  todayActivity,
  onUseFreeze,
}: StreakStatusCardProps) => {
  const streakImage = streakData.hasReadingToday
    ? BRACK_STREAK_HAPPY_IMAGE
    : BRACK_STREAK_SAD_IMAGE;
  const statusLabel = streakData.hasReadingToday
    ? "On track"
    : streakData.usedFreezeToday
    ? "Protected"
    : streakData.canUseFreezeToday
    ? "Needs reading"
    : "Start today";
  const todayMinutes = todayActivity?.totalMinutes || 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_6rem] sm:items-center">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <APP_ICONS.dashboard.streak className="h-5 w-5 text-primary" />
                <h3 className="font-display text-lg font-semibold">Reading Streak</h3>
              </div>
              <img
                src={streakImage}
                alt=""
                aria-hidden="true"
                className="h-16 w-16 shrink-0 rounded-md border border-border/70 bg-background object-contain p-1.5 sm:hidden"
                draggable={false}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="font-sans text-2xl font-bold text-primary">
                  {streakData.currentStreak}
                </div>
                <p className="font-sans text-xs text-muted-foreground">current</p>
              </div>
              <div>
                <div className="font-sans text-2xl font-bold">
                  {streakData.longestStreak}
                </div>
                <p className="font-sans text-xs text-muted-foreground">best</p>
              </div>
              <div>
                <div className="font-sans text-2xl font-bold">
                  {todayMinutes}
                </div>
                <p className="font-sans text-xs text-muted-foreground">min today</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {statusLabel}
              </Badge>
              {streakData.canUseFreezeToday && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!streakData.freezeAvailable}
                  onClick={() => void onUseFreeze()}
                >
                  Use Freeze
                </Button>
              )}
            </div>
          </div>

          <img
            src={streakImage}
            alt=""
            aria-hidden="true"
            className="hidden h-24 w-24 rounded-md border border-border/70 bg-background object-contain p-2 sm:block"
            draggable={false}
          />
        </div>
      </CardContent>
    </Card>
  );
};

interface AchievementsPreviewProps {
  loading: boolean;
  badges: Array<{ id: string; title: string; description: string | null; icon_url: string | null; created_at: string }>;
  earnedBadges: Array<{ id: string; user_id: string; badge_id: string; earned_at: string }>;
  onViewAll: () => void;
}

const AchievementsPreview = ({
  loading,
  badges,
  earnedBadges,
  onViewAll,
}: AchievementsPreviewProps) => {
  if (loading || badges.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display flex items-center justify-between text-base md:text-lg">
          <span className="flex items-center">
            <img
              src={BRACK_TROPHY_IMAGE}
              alt=""
              aria-hidden="true"
              className="mr-2 h-8 w-8 rounded-md border border-border/70 object-cover"
              draggable={false}
            />
            Achievements
          </span>
          <Button variant="outline" size="sm" onClick={onViewAll}>
            View All
            <NavArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-sans mb-4 text-sm text-muted-foreground">
          {earnedBadges.length} of {badges.length} badges earned
        </p>
        <BadgeDisplay badges={badges.slice(0, 4)} earnedBadges={earnedBadges} />
      </CardContent>
    </Card>
  );
};

interface RecentActivityCardProps {
  activities: Array<{ id: string; description: string; timestamp: string }>;
  loading: boolean;
  formatTimeAgo: (timestamp: string) => string;
}

const RecentActivityCard = ({
  activities,
  loading,
  formatTimeAgo,
}: RecentActivityCardProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display flex items-center text-base md:text-lg">
          <APP_ICONS.dashboard.recentActivity className="mr-2 h-5 w-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <ActivityItemSkeleton />
            <ActivityItemSkeleton />
            <ActivityItemSkeleton />
          </div>
        ) : activities.length === 0 ? (
          <div className="py-6 text-center">
            <APP_ICONS.dashboard.recentActivity className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-sans text-sm text-muted-foreground">
              Start reading to see your progress here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 5).map((activity) => (
              <div key={activity.id} className="font-sans flex items-center gap-3 text-sm">
                <div className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {activity.description}
                </span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatTimeAgo(activity.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

const SectionHeader = ({ title, subtitle, icon, action }: SectionHeaderProps) => {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold md:text-xl">{title}</h2>
          {subtitle && (
            <p className="font-sans text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

interface BookCoverProps {
  book: BookType;
  className: string;
}

const BookCover = ({ book, className }: BookCoverProps) => {
  if (book.cover_url) {
    return (
      <img
        src={book.cover_url}
        alt={book.title}
        className={`${className} rounded-md border border-border/70 object-cover shadow-sm`}
        draggable={false}
      />
    );
  }

  return (
    <div className={`${className} flex items-center justify-center rounded-md border border-border/70 bg-primary/10 text-primary`}>
      <APP_ICONS.dashboard.coverFallback className="h-8 w-8" />
    </div>
  );
};

const getActivityTypeLabel = (type: DashboardBookCandidate["lastActivityType"]) => {
  switch (type) {
    case "progress_log":
      return "Progress logged";
    case "reading_session":
      return "Read";
    case "date_started":
      return "Started";
    case "created":
      return "Added";
    case "book_update":
    default:
      return "Updated";
  }
};

export default Dashboard;
