import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Target, Clock, BarChart3, ArrowRight, Library } from "lucide-react";
import { BookCard } from "@/components/BookCard";
import { StreakDisplay } from "@/components/StreakDisplay";
import { StreakCalendar } from "@/components/StreakCalendar";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useBadges } from "@/hooks/useBadges";
import { useStreaks } from "@/hooks/useStreaks";
import { useRecentActivity } from "@/hooks/useRecentActivity";
import { useChartData } from "@/hooks/useChartData";
import { WeeklyReadingChart } from "@/components/charts/WeeklyReadingChart";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Goal, Profile } from "@/types";
import { DashboardCardSkeleton } from "@/components/skeletons/DashboardCardSkeleton";
import { BookCardSkeleton } from "@/components/skeletons/BookCardSkeleton";
import { ActivityItemSkeleton } from "@/components/skeletons/ActivityItemSkeleton";
import { PullToRefresh } from "@/components/PullToRefresh";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { GoalsSheet } from "@/components/GoalsSheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { SwipeableBookListsCarousel } from "@/components/SwipeableBookListsCarousel";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const { books, loading: booksLoading, refetchBooks } = useBooks(user?.id);
  const { checkAndAwardBadges } = useBadges(user?.id);
  const { streakData, activityCalendar, refetchStreaks, useStreakFreeze } = useStreaks(user?.id);
  const { activities, loading: activitiesLoading, formatTimeAgo } = useRecentActivity(user?.id);
  const { weeklyReading, loading: chartLoading } = useChartData(user?.id);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      loadGoalData();
      loadProfile();
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
      const { data: sessions } = await supabase
        .from('reading_sessions')
        .select('*')
        .eq('user_id', user.id);

      await checkAndAwardBadges(books, sessions || []);
    } catch (error) {
      console.error('Error checking badges:', error);
    }
  };

  const loadGoalData = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      setGoal(data);
    } catch (error: any) {
      console.error('Error loading goal:', error);
      toast.error("Failed to load goal data");
    }
  };

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      setProfile(data);
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const handleBookClick = (bookId: string) => {
    navigate(`/book/${bookId}`);
  };

  const handleRefresh = async () => {
    await Promise.all([
      refetchBooks(),
      refetchStreaks(),
      loadGoalData(),
      loadProfile(),
    ]);
  };

  const completedBooks = books.filter(book => book.status === "completed").length;
  const progressPercentage = goal ? Math.round((completedBooks / goal.target_books) * 100) : 0;

  if (authLoading) {
    return (
      <MobileLayout showBottomNav={false}>
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" text="Loading your reading journey..." />
        </div>
      </MobileLayout>
    );
  }

  const displayName = profile?.display_name || 
                      user?.user_metadata?.full_name || 
                      user?.user_metadata?.name || 
                      user?.email?.split('@')[0] || 
                      'Reader';

  return (
    <MobileLayout>
      <PullToRefresh onRefresh={handleRefresh}>
        {isMobile && (
          <MobileHeader 
            title="Home" 
            action={<GoalsSheet />}
          />
        )}
        
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Desktop Header */}
          {!isMobile && (
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold">Welcome back, {displayName}! 👋</h1>
              <p className="text-muted-foreground">Here's what's happening with your reading journey</p>
            </div>
          )}

          {/* Mobile Welcome */}
          {isMobile && (
            <div>
              <h2 className="text-xl font-bold">Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}! 👋</h2>
              <p className="text-sm text-muted-foreground">Here's your reading journey</p>
            </div>
          )}

          {/* Progress Overview */}
          {booksLoading ? (
            <DashboardCardSkeleton />
          ) : goal ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base md:text-lg">
                  <Target className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                  Your Reading Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4">
                <div className="flex justify-between text-xs md:text-sm">
                  <span>Books Read: {completedBooks} / {goal.target_books}</span>
                  <span>{progressPercentage}% Complete</span>
                </div>
                <Progress value={progressPercentage} className="w-full" />
                <div className="grid grid-cols-3 gap-3 md:gap-4 text-center">
                  <div className="space-y-0.5 md:space-y-1">
                    <div className="text-xl md:text-2xl font-bold text-primary">{completedBooks}</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Completed</div>
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    <div className="text-xl md:text-2xl font-bold text-primary">42h</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Reading Time</div>
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    <div className="text-xl md:text-2xl font-bold text-primary">58</div>
                    <div className="text-xs md:text-sm text-muted-foreground">Pages/Hour</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Desktop Quick Actions */}
          {!isMobile && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                onClick={() => navigate("/add-book")}
                className="h-20 text-lg"
              >
                <BookOpen className="mr-2 h-6 w-6" />
                Add New Book
              </Button>
              <Button 
                onClick={() => navigate("/my-books")}
                variant="outline"
                className="h-20 text-lg"
              >
                <Library className="mr-2 h-6 w-6" />
                View My Books
              </Button>
            </div>
          )}

          {/* Reading Streaks Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <StreakDisplay 
              streakData={streakData} 
              onUseFreeze={useStreakFreeze}
            />
            <StreakCalendar activityCalendar={activityCalendar} />
          </div>

          {/* Analytics Snippet */}
          {!chartLoading && weeklyReading.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base md:text-lg font-semibold flex items-center">
                  <BarChart3 className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                  This Week's Reading
                </h3>
                <Button variant="outline" size="sm" onClick={() => navigate("/analytics")}>
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              <WeeklyReadingChart data={weeklyReading} />
            </div>
          )}

          {/* Book Lists Carousel */}
          <SwipeableBookListsCarousel />

          {/* My Books Snippet */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base md:text-lg">
                <span className="flex items-center">
                  <Library className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                  My Books
                </span>
                <Button variant="outline" size="sm" onClick={() => navigate("/my-books")}>
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {booksLoading ? (
                <div className="space-y-3">
                  <BookCardSkeleton />
                  <BookCardSkeleton />
                </div>
              ) : books.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No books yet. Add your first book to get started!</p>
                  {!isMobile && (
                    <Button onClick={() => navigate("/add-book")}>
                      <BookOpen className="mr-2 h-4 w-4" />
                      Add Your First Book
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {books.slice(0, 3).map((book) => (
                    <BookCard 
                      key={book.id} 
                      book={book} 
                      onClick={() => handleBookClick(book.id)}
                    />
                  ))}
                  {books.length > 3 && (
                    <div className="text-center pt-4">
                      <Button variant="outline" onClick={() => navigate("/my-books")}>
                        See {books.length - 3} more books
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base md:text-lg">
                <Clock className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="space-y-3">
                  <ActivityItemSkeleton />
                  <ActivityItemSkeleton />
                  <ActivityItemSkeleton />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No recent activity. Start reading to see your progress here!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-3 text-sm">
                      <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
                      <span className="text-muted-foreground flex-1 min-w-0 truncate">{activity.description}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PullToRefresh>
      
      {/* Mobile FAB */}
      {isMobile && <FloatingActionButton />}
    </MobileLayout>
  );
};

export default Dashboard;
