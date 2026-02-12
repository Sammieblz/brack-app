import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Share2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { shareService } from "@/services/shareService";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Book } from "@/types";

interface ReadingStatsWidgetProps {
  userId: string;
  books: Book[];
  currentStreak: number;
  displayName?: string;
}

export const ReadingStatsWidget = ({ 
  userId, 
  books, 
  currentStreak,
  displayName 
}: ReadingStatsWidgetProps) => {
  const [stats, setStats] = useState({
    totalBooks: 0,
    completedBooks: 0,
    totalReadingHours: 0,
    totalPages: 0,
    avgPagesPerHour: 0,
    longestBook: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, [userId, books]);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Get reading sessions
      const { data: sessions } = await supabase
        .from('reading_sessions')
        .select('duration, book_id')
        .eq('user_id', userId);

      // Calculate total reading time
      const totalMinutes = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

      // Calculate total pages read
      const totalPages = books.reduce((sum, book) => {
        if (book.status === 'completed' && book.pages) {
          return sum + book.pages;
        } else if (book.current_page) {
          return sum + book.current_page;
        }
        return sum;
      }, 0);

      // Calculate average pages per hour
      const avgPagesPerHour = totalHours > 0 ? Math.round((totalPages / totalHours) * 10) / 10 : 0;

      // Find longest book
      const longestBook = Math.max(...books.map(b => b.pages || 0), 0);

      setStats({
        totalBooks: books.length,
        completedBooks: books.filter(b => b.status === 'completed').length,
        totalReadingHours: totalHours,
        totalPages,
        avgPagesPerHour,
        longestBook,
      });
    } catch (error: unknown) {
      console.error('Error loading reading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await shareService.shareReadingStats({
        booksCompleted: stats.completedBooks,
        totalHours: stats.totalReadingHours,
        currentStreak,
        username: displayName,
      });
    } catch (error: unknown) {
      if (error instanceof Error && !error.message?.includes('cancelled')) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to share reading stats",
        });
      }
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <LoadingSpinner size="sm" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-base md:text-lg">
            <BarChart3 className="h-4 w-4 md:h-5 md:w-5 mr-2" />
            Reading Statistics
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleShare}
              title="Share reading stats"
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate('/analytics')}
              title="View detailed analytics"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="text-2xl md:text-3xl font-bold text-primary">{stats.totalBooks}</div>
            <div className="text-xs md:text-sm text-muted-foreground">Total Books</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl md:text-3xl font-bold text-green-500">{stats.completedBooks}</div>
            <div className="text-xs md:text-sm text-muted-foreground">Completed</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl md:text-3xl font-bold text-blue-500">{stats.totalReadingHours}h</div>
            <div className="text-xs md:text-sm text-muted-foreground">Reading Time</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl md:text-3xl font-bold text-purple-500">{stats.totalPages.toLocaleString()}</div>
            <div className="text-xs md:text-sm text-muted-foreground">Pages Read</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl md:text-3xl font-bold text-orange-500">{stats.avgPagesPerHour}</div>
            <div className="text-xs md:text-sm text-muted-foreground">Pages/Hour</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl md:text-3xl font-bold text-indigo-500">{stats.longestBook}</div>
            <div className="text-xs md:text-sm text-muted-foreground">Longest Book</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
