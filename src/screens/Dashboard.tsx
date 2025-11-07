import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Plus, Timer, Target, Clock, BarChart3, ArrowRight, Library } from "lucide-react";
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
import { Navbar } from "@/components/Navbar";
import type { Goal, ReadingSession, Profile } from "@/types";

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { books, loading: booksLoading, refetchBooks } = useBooks(user?.id);
  const { checkAndAwardBadges } = useBadges(user?.id);
  const { streakData, activityCalendar, loading: streaksLoading, refetchStreaks, useStreakFreeze } = useStreaks(user?.id);
  const { activities, loading: activitiesLoading, formatTimeAgo } = useRecentActivity(user?.id);
  const { readingProgress, genreData, weeklyReading, loading: chartLoading } = useChartData(user?.id);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
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
    // Hide welcome message after 5 seconds
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Check and award badges when books are loaded
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

  const completedBooks = books.filter(book => book.status === "completed").length;
  const progressPercentage = goal ? Math.round((completedBooks / goal.target_books) * 100) : 0;

  if (authLoading || booksLoading) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" text="Loading your reading journey..." />
        </div>
      </div>
    );
  }

  const displayName = profile?.display_name || 
                      user?.user_metadata?.full_name || 
                      user?.user_metadata?.name || 
                      user?.email?.split('@')[0] || 
                      'Reader';

  return (
    <div className="min-h-screen bg-gradient-background">
      <Navbar />
      
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Welcome Header */}
        {showWelcome && (
          <div className="text-center space-y-2 animate-in fade-in duration-500">
            <h1 className="text-3xl font-bold">Welcome back, {displayName}! 👋</h1>
            <p className="text-muted-foreground">Here&apos;s what&apos;s happening with your reading journey</p>
          </div>
        )}

        {/* Progress Overview */}
        {goal && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Your Reading Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Books Read: {completedBooks} / {goal.target_books}</span>
                <span>{progressPercentage}% Complete</span>
              </div>
              <Progress value={progressPercentage} className="w-full" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-primary">{completedBooks}</div>
                  <div className="text-sm text-muted-foreground">Books Completed</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-primary">42h</div>
                  <div className="text-sm text-muted-foreground">Total Reading Time</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-primary">58</div>
                  <div className="text-sm text-muted-foreground">Pages/Hour Avg</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button 
            onClick={() => navigate("/add-book")}
            className="h-20 text-lg"
          >
            <Plus className="mr-2 h-6 w-6" />
            Add New Book
          </Button>
          <Button 
            onClick={() => navigate("/books")}
            variant="outline"
            className="h-20 text-lg"
          >
            <Library className="mr-2 h-6 w-6" />
            View My Books
          </Button>
        </div>

        {/* Reading Streaks Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StreakDisplay 
            streakData={streakData} 
            onUseFreeze={useStreakFreeze}
          />
          <StreakCalendar activityCalendar={activityCalendar} />
        </div>

        {/* Analytics Snippet */}
        {!chartLoading && weeklyReading.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  This Week's Reading
                </span>
                <Button variant="outline" size="sm" onClick={() => navigate("/analytics")}>
                  <ArrowRight className="h-4 w-4 ml-1" />
                  View Analytics
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WeeklyReadingChart data={weeklyReading} />
            </CardContent>
          </Card>
        )}

        {/* My Books Snippet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Library className="h-5 w-5 mr-2" />
                My Books
              </span>
              <Button variant="outline" size="sm" onClick={() => navigate("/books")}>
                <ArrowRight className="h-4 w-4 ml-1" />
                View All Books
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {books.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No books yet. Add your first book to get started!</p>
                <Button onClick={() => navigate("/add-book")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Book
                </Button>
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
                    <Button variant="outline" onClick={() => navigate("/books")}>
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
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner size="sm" text="Loading activities..." />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No recent activity. Start reading to see your progress here!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3 text-sm">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-muted-foreground flex-1">{activity.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;