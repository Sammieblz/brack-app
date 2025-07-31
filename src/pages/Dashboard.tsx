import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, Timer, LogOut, User, Target, Clock } from "lucide-react";

interface Goal {
  id: string;
  target_books: number;
  start_date: string;
  end_date: string;
  is_completed: boolean;
}

interface Book {
  id: string;
  title: string;
  author: string;
  status: string;
  pages: number;
  genre: string;
  cover_url?: string;
}

const Dashboard = () => {
  const [user, setUser] = useState<any>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);
      await loadUserData(user.id);
    };

    checkAuth();
  }, [navigate]);

  const loadUserData = async (userId: string) => {
    try {
      // For now, we'll use mock data since the types aren't synced yet
      // This will be replaced with actual Supabase queries once types are available
      setGoal({
        id: "1",
        target_books: 12,
        start_date: "2024-01-01",
        end_date: "2024-12-31",
        is_completed: false
      });

      setBooks([
        {
          id: "1",
          title: "The Alchemist",
          author: "Paulo Coelho",
          status: "reading",
          pages: 210,
          genre: "Fiction"
        },
        {
          id: "2",
          title: "Atomic Habits",
          author: "James Clear",
          status: "completed",
          pages: 320,
          genre: "Self-Help"
        }
      ]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading data",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error signing out",
        description: error.message,
      });
    } else {
      navigate("/auth");
    }
  };

  const completedBooks = books.filter(book => book.status === "completed").length;
  const progressPercentage = goal ? Math.round((completedBooks / goal.target_books) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <BookOpen className="h-8 w-8 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading your reading journey...</p>
        </div>
      </div>
    );
  }

  const displayName = user?.user_metadata?.full_name || 
                      user?.user_metadata?.name || 
                      user?.email?.split('@')[0] || 
                      'Reader';

  return (
    <div className="min-h-screen bg-background p-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {books.slice(0, 6).map((book) => (
                  <Card key={book.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-sm line-clamp-2">{book.title}</h3>
                          <Badge 
                            variant={book.status === "completed" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {book.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{book.author}</p>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>{book.genre}</span>
                          <span>{book.pages} pages</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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