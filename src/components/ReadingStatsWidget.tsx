import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  Book as BookIcon,
  CheckCircle,
  Clock,
  Flash,
  Page,
  ShareIos,
  StatsReport,
  Trophy,
} from "iconoir-react";
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

  const completionRate = stats.totalBooks > 0
    ? Math.round((stats.completedBooks / stats.totalBooks) * 100)
    : 0;
  const pagesPerBook = stats.totalBooks > 0
    ? Math.round(stats.totalPages / stats.totalBooks)
    : 0;

  const metrics = [
    {
      label: "Reading time",
      value: `${stats.totalReadingHours.toLocaleString(undefined, { maximumFractionDigits: 1 })}h`,
      detail: "logged sessions",
      icon: Clock,
    },
    {
      label: "Pages read",
      value: stats.totalPages.toLocaleString(),
      detail: `${pagesPerBook.toLocaleString()} avg / book`,
      icon: Page,
    },
    {
      label: "Pace",
      value: stats.avgPagesPerHour.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      detail: "pages / hour",
      icon: Flash,
    },
    {
      label: "Longest book",
      value: stats.longestBook.toLocaleString(),
      detail: "pages",
      icon: Trophy,
    },
  ];

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
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="font-display flex items-center text-base md:text-lg">
              <StatsReport className="h-4 w-4 md:h-5 md:w-5 mr-2" />
              Reading Statistics
            </CardTitle>
            <p className="font-sans text-sm text-muted-foreground">
              Your library, pace, and activity at a glance
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleShare}
              title="Share reading stats"
            >
              <ShareIos className="h-4 w-4" />
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
      <CardContent className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.9fr)_1.6fr]">
          <section className="rounded-md border border-border/70 bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Library
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-sans text-4xl font-bold text-foreground">
                    {stats.totalBooks.toLocaleString()}
                  </span>
                  <span className="font-sans text-sm text-muted-foreground">books</span>
                </div>
                <p className="font-sans text-sm text-muted-foreground">
                  {stats.completedBooks.toLocaleString()} completed
                </p>
              </div>
              <div className="rounded-md bg-background p-2 text-primary ring-1 ring-border/70">
                <BookIcon className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between font-sans text-sm">
                <span className="text-muted-foreground">Completion</span>
                <span className="font-medium">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border/70 pt-4">
              <div>
                <div className="flex items-center gap-1.5 text-primary">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-sans text-lg font-semibold">
                    {stats.completedBooks.toLocaleString()}
                  </span>
                </div>
                <p className="font-sans text-xs text-muted-foreground">finished</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-primary">
                  <Trophy className="h-4 w-4" />
                  <span className="font-sans text-lg font-semibold">
                    {currentStreak.toLocaleString()}
                  </span>
                </div>
                <p className="font-sans text-xs text-muted-foreground">day streak</p>
              </div>
            </div>
          </section>

          <section className="grid gap-px overflow-hidden rounded-md border border-border/70 bg-border sm:grid-cols-2">
            {metrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <div key={metric.label} className="bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-sans text-sm text-muted-foreground">{metric.label}</p>
                      <p className="mt-2 font-sans text-2xl font-semibold leading-none text-foreground md:text-3xl">
                        {metric.value}
                      </p>
                      <p className="mt-2 font-sans text-xs text-muted-foreground">{metric.detail}</p>
                    </div>
                    <div className="rounded-md bg-muted p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </CardContent>
    </Card>
  );
};
