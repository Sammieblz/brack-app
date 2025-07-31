import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Plus, Timer, LogOut, User, Target, Clock } from "lucide-react";
import { BookCard } from "@/components/BookCard";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Goal } from "@/types";

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { books, loading: booksLoading, refetchBooks } = useBooks(user?.id);
  const [goal, setGoal] = useState<Goal | null>(null);
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

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      navigate("/");
    } catch (error: any) {
      toast.error("Error signing out");
    }
  };

  const handleBookClick = (bookId: string) => {
    navigate(`/book/${bookId}`);
  };

  const completedBooks = books.filter(book => book.status === "completed").length;
  const progressPercentage = goal ? Math.round((completedBooks / goal.target_books) * 100) : 0;

  if (authLoading || booksLoading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading your reading journey..." />
      </div>
    );
  }

  const displayName = user?.user_metadata?.full_name || 
                      user?.user_metadata?.name || 
                      user?.email?.split('@')[0] || 
                      'Reader';

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Hello, {displayName}! 👋</h1>
              <p className="text-muted-foreground">Welcome back to your reading journey</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>
              <User className="h-4 w-4 mr-2" />
              Profile
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

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
            onClick={() => navigate("/timer")}
            variant="outline"
            className="h-20 text-lg"
          >
            <Timer className="mr-2 h-6 w-6" />
            Start Reading Timer
          </Button>
        </div>

        {/* My Books */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                My Books
              </span>
              <Button variant="outline" size="sm" onClick={() => navigate("/books")}>
                View All
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
                {books.slice(0, 6).map((book) => (
                  <BookCard 
                    key={book.id} 
                    book={book} 
                    onClick={() => handleBookClick(book.id)}
                  />
                ))}
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
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-sm">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-muted-foreground">Completed reading "Atomic Habits"</span>
                <span className="text-xs text-muted-foreground">2 days ago</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-muted-foreground">Started reading "The Alchemist"</span>
                <span className="text-xs text-muted-foreground">1 week ago</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <span className="text-muted-foreground">Set reading goal: 12 books this year</span>
                <span className="text-xs text-muted-foreground">2 weeks ago</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;