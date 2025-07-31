import { useAuth } from "@/hooks/useAuth";
import { useChartData } from "@/hooks/useChartData";
import { Navbar } from "@/components/Navbar";
import { ReadingProgressChart } from "@/components/charts/ReadingProgressChart";
import { GenreDistributionChart } from "@/components/charts/GenreDistributionChart";
import { WeeklyReadingChart } from "@/components/charts/WeeklyReadingChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, BookOpen, Clock } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useBooks } from "@/hooks/useBooks";

const Analytics = () => {
  const { user } = useAuth();
  const { books } = useBooks(user?.id);
  const { readingProgress, genreData, weeklyReading, loading } = useChartData(user?.id);

  // Calculate analytics stats
  const totalMinutes = readingProgress.reduce((sum, day) => sum + day.minutes, 0);
  const totalHours = Math.round(totalMinutes / 60);
  const avgMinutesPerDay = Math.round(totalMinutes / readingProgress.length) || 0;
  const completedBooks = books.filter(book => book.status === "completed").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" text="Loading analytics..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <Navbar />
      
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Insights into your reading journey
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Books Completed</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{completedBooks}</div>
              <p className="text-xs text-muted-foreground">
                +{completedBooks} this year
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reading Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{totalHours}h</div>
              <p className="text-xs text-muted-foreground">
                {totalMinutes} minutes total
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{avgMinutesPerDay}m</div>
              <p className="text-xs text-muted-foreground">
                per day this period
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Favorite Genre</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {genreData[0]?.genre || "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                {genreData[0]?.count || 0} books
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="space-y-6">
          {/* Reading Progress Chart */}
          {readingProgress.length > 0 && (
            <ReadingProgressChart data={readingProgress} />
          )}
          
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {genreData.length > 0 && (
              <GenreDistributionChart data={genreData} />
            )}
            {weeklyReading.length > 0 && (
              <WeeklyReadingChart data={weeklyReading} />
            )}
          </div>
        </div>

        {/* No Data State */}
        {readingProgress.length === 0 && genreData.length === 0 && weeklyReading.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No analytics data yet</h3>
              <p className="text-muted-foreground">
                Start reading and tracking your sessions to see beautiful analytics here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Analytics;