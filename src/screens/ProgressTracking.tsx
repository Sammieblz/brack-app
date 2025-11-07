import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Target, Clock, Zap, TrendingUp } from "lucide-react";
import { useProgressTracking } from "@/hooks/useProgressTracking";
import { useBookProgress } from "@/hooks/useBookProgress";
import { ReadingVelocityChart } from "@/components/charts/ReadingVelocityChart";
import { DailyPagesChart } from "@/components/charts/DailyPagesChart";
import { CompletionForecastChart } from "@/components/charts/CompletionForecastChart";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Book } from "@/types";

const ProgressTracking = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const { dailyProgress, velocityData, forecastData, loading } = useProgressTracking(id);
  const { progress } = useBookProgress(id);

  useEffect(() => {
    if (!id) return;
    
    const fetchBook = async () => {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .single();
      
      if (!error && data) {
        setBook(data);
      }
    };
    
    fetchBook();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading progress data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/book/${id}`)}
            className="border-border/50 hover:shadow-soft transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Book
          </Button>
        </div>

        {/* Title */}
        <div className="text-center space-y-2 animate-fade-in">
          <h1 className="text-3xl font-bold text-gradient">Progress Tracking</h1>
          {book && (
            <p className="text-muted-foreground">{book.title}</p>
          )}
        </div>

        {/* Key Metrics */}
        {progress && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-scale-in">
            <Card className="bg-gradient-card border-0 shadow-medium">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <Target className="h-4 w-4 mr-2" />
                  Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{progress.progress_percentage.toFixed(0)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {progress.current_page} / {progress.total_pages} pages
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-0 shadow-medium">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <Zap className="h-4 w-4 mr-2" />
                  Velocity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{progress.reading_velocity.recent.toFixed(1)}</div>
                <p className="text-xs text-muted-foreground mt-1">pages/hour</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-0 shadow-medium">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Time Spent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{progress.total_time_hours.toFixed(1)}h</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {progress.statistics.total_sessions} sessions
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-0 shadow-medium">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Days Left
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {progress.estimated_days_to_completion || "N/A"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  estimated days
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts */}
        <div className="space-y-6 animate-fade-in">
          <ReadingVelocityChart data={velocityData} />
          
          <DailyPagesChart data={dailyProgress} />
          
          {book?.pages && (
            <CompletionForecastChart 
              data={forecastData} 
              totalPages={book.pages}
            />
          )}
        </div>

        {/* Reading Insights */}
        {progress && dailyProgress.length > 0 && (
          <Card className="bg-gradient-card border-0 shadow-medium animate-scale-in">
            <CardHeader>
              <CardTitle>Reading Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm text-muted-foreground">Most productive day</span>
                <span className="font-medium">
                  {dailyProgress.reduce((max, d) => d.pages_read > max.pages_read ? d : max, dailyProgress[0])?.pages_read || 0} pages
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm text-muted-foreground">Average session</span>
                <span className="font-medium">
                  {progress.statistics.avg_session_duration} min
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm text-muted-foreground">Reading streak</span>
                <span className="font-medium">
                  {dailyProgress.length} days
                </span>
              </div>
              
              {progress.estimated_completion_date && (
                <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <span className="text-sm text-muted-foreground">Estimated completion</span>
                  <span className="font-medium text-primary">
                    {new Date(progress.estimated_completion_date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {dailyProgress.length === 0 && (
          <Card className="bg-gradient-card border-0 shadow-medium">
            <CardContent className="text-center py-12">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Progress Data Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start logging your reading progress to see detailed analytics and forecasts
              </p>
              <Button onClick={() => navigate(`/book/${id}`)}>
                Go to Book Details
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProgressTracking;
