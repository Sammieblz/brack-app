import { useAuth } from "@/hooks/useAuth";
import { useChartData } from "@/hooks/useChartData";
import { ReadingProgressChart } from "@/components/charts/ReadingProgressChart";
import { GenreDistributionChart } from "@/components/charts/GenreDistributionChart";
import { WeeklyReadingChart } from "@/components/charts/WeeklyReadingChart";
import { ReadingVelocityChart } from "@/components/charts/ReadingVelocityChart";
import { CompletionRateChart } from "@/components/charts/CompletionRateChart";
import { ReadingHeatmap } from "@/components/charts/ReadingHeatmap";
import { BookLengthScatter } from "@/components/charts/BookLengthScatter";
import { MonthlyGoalsChart } from "@/components/charts/MonthlyGoalsChart";
import { StreaksTimelineChart } from "@/components/charts/StreaksTimelineChart";
import { ReadingPaceChart } from "@/components/charts/ReadingPaceChart";
import { TopAuthorsChart } from "@/components/charts/TopAuthorsChart";
import { TimeDistributionChart } from "@/components/charts/TimeDistributionChart";
import { StatusFunnelChart } from "@/components/charts/StatusFunnelChart";
import { ChartSkeleton } from "@/components/skeletons/ChartSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, BookOpen, Clock } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useBooks } from "@/hooks/useBooks";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Analytics = () => {
  const { user } = useAuth();
  const { books } = useBooks(user?.id);
  const { 
    readingProgress, 
    genreData, 
    weeklyReading,
    readingVelocity,
    completionRate,
    heatmapData,
    scatterData,
    monthlyGoals,
    streakTimeline,
    paceData,
    topAuthors,
    timeDistribution,
    statusFunnel,
    loading 
  } = useChartData(user?.id);
  const isMobile = useIsMobile();

  // Calculate analytics stats
  const totalMinutes = readingProgress.reduce((sum, day) => sum + day.minutes, 0);
  const totalHours = Math.round(totalMinutes / 60);
  const avgMinutesPerDay = Math.round(totalMinutes / readingProgress.length) || 0;
  const completedBooks = books.filter(book => book.status === "completed").length;

  if (loading) {
    return (
      <MobileLayout>
        {isMobile && <MobileHeader title="Analytics" showBack />}
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" text="Loading analytics..." />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      {isMobile && <MobileHeader title="Analytics" showBack />}
      
      <div className="container max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header - Desktop only */}
        {!isMobile && (
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="font-display text-3xl font-bold">Analytics Dashboard</h1>
              <p className="font-sans text-muted-foreground">
                Insights into your reading journey
              </p>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Books Completed</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-sans text-2xl font-bold text-primary">{completedBooks}</div>
              <p className="font-sans text-xs text-muted-foreground">
                +{completedBooks} this year
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-sans text-sm font-medium">Total Reading Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-sans text-2xl font-bold text-primary">{totalHours}h</div>
              <p className="font-sans text-xs text-muted-foreground">
                {totalMinutes} minutes total
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-sans text-sm font-medium">Daily Average</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-sans text-2xl font-bold text-primary">{avgMinutesPerDay}m</div>
              <p className="font-sans text-xs text-muted-foreground">
                per day this period
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-sans text-sm font-medium">Favorite Genre</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-sans text-2xl font-bold text-primary">
                {genreData[0]?.genre || "N/A"}
              </div>
              <p className="font-sans text-xs text-muted-foreground">
                {genreData[0]?.count || 0} books
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Reading Progress Chart */}
            {loading ? (
              <ChartSkeleton />
            ) : readingProgress.length > 0 ? (
              <ReadingProgressChart data={readingProgress} />
            ) : null}
            
            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {loading ? (
                <>
                  <ChartSkeleton />
                  <ChartSkeleton />
                </>
              ) : (
                <>
                  {genreData.length > 0 && (
                    <GenreDistributionChart data={genreData} />
                  )}
                  {weeklyReading.length > 0 && (
                    <WeeklyReadingChart data={weeklyReading} />
                  )}
                </>
              )}
            </div>

            {/* Status Funnel */}
            {loading ? (
              <ChartSkeleton />
            ) : statusFunnel.length > 0 ? (
              <StatusFunnelChart data={statusFunnel} />
            ) : null}
          </TabsContent>

          <TabsContent value="detailed" className="space-y-6">
            {/* Reading Velocity */}
            {loading ? (
              <ChartSkeleton />
            ) : readingVelocity.length > 0 ? (
              <ReadingVelocityChart data={readingVelocity} />
            ) : null}

            {/* Completion Rate */}
            {loading ? (
              <ChartSkeleton />
            ) : completionRate.length > 0 ? (
              <CompletionRateChart data={completionRate} />
            ) : null}

            {/* Book Length Scatter */}
            {loading ? (
              <ChartSkeleton />
            ) : scatterData.length > 0 ? (
              <BookLengthScatter data={scatterData} />
            ) : null}

            {/* Monthly Goals */}
            {loading ? (
              <ChartSkeleton />
            ) : monthlyGoals.length > 0 ? (
              <MonthlyGoalsChart data={monthlyGoals} />
            ) : null}

            {/* Streak Timeline */}
            {loading ? (
              <ChartSkeleton />
            ) : streakTimeline.length > 0 ? (
              <StreaksTimelineChart data={streakTimeline} />
            ) : null}
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            {/* Reading Heatmap */}
            {loading ? (
              <ChartSkeleton />
            ) : heatmapData.length > 0 ? (
              <ReadingHeatmap data={heatmapData} />
            ) : null}

            {/* Reading Pace */}
            {loading ? (
              <ChartSkeleton />
            ) : paceData.length > 0 ? (
              <ReadingPaceChart data={paceData} />
            ) : null}

            {/* Top Authors */}
            {loading ? (
              <ChartSkeleton />
            ) : topAuthors.length > 0 ? (
              <TopAuthorsChart data={topAuthors} />
            ) : null}

            {/* Time Distribution */}
            {loading ? (
              <ChartSkeleton />
            ) : timeDistribution.length > 0 ? (
              <TimeDistributionChart data={timeDistribution} />
            ) : null}
          </TabsContent>
        </Tabs>

        {/* No Data State */}
        {!loading && readingProgress.length === 0 && genreData.length === 0 && weeklyReading.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-lg font-semibold mb-2">No analytics data yet</h3>
              <p className="text-muted-foreground">
                Start reading and tracking your sessions to see beautiful analytics here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
};

export default Analytics;