import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTimer } from "@/contexts/TimerContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Clock, CheckCircle, Edit, Trash2, Play, Star, TrendingUp, Calendar, BookOpen, FileText, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { formatDuration } from "@/utils";
import { QuickProgressWidget } from "@/components/QuickProgressWidget";
import { ProgressLogger } from "@/components/ProgressLogger";
import { ProgressLogItem } from "@/components/ProgressLogItem";
import { useProgressLogs } from "@/hooks/useProgressLogs";
import { useBookProgress } from "@/hooks/useBookProgress";
import { JournalEntriesList } from "@/components/JournalEntriesList";
import { AddToListDialog } from "@/components/AddToListDialog";
import { useAuth } from "@/hooks/useAuth";
import type { Book, ReadingSession } from "@/types";

const BookDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProgressLogger, setShowProgressLogger] = useState(false);
  const navigate = useNavigate();
  const { startTimer } = useTimer();
  const { logs, refetchLogs } = useProgressLogs(id);
  const { progress, refetchProgress } = useBookProgress(id);
  const { user } = useAuth();

  useEffect(() => {
    if (!id) return;
    loadBookData();
  }, [id]);

  const loadBookData = async () => {
    if (!id) return;
    
    try {
      // Get book details
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (bookError) throw bookError;
      if (!bookData) {
        toast.error("Book not found");
        navigate("/dashboard");
        return;
      }

      setBook(bookData);

      // Get reading sessions
      const { data: sessionData, error: sessionError } = await supabase
        .from('reading_sessions')
        .select('*')
        .eq('book_id', id)
        .order('created_at', { ascending: false });

      if (sessionError) throw sessionError;
      setSessions(sessionData || []);
    } catch (error: any) {
      console.error('Error loading book:', error);
      toast.error("Failed to load book details");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: 'reading' | 'completed' | 'to_read') => {
    if (!book) return;

    try {
      const updateData: any = { 
        status: newStatus, 
        updated_at: new Date().toISOString() 
      };

      // Set date_finished when marking as completed
      if (newStatus === 'completed' && !book.date_finished) {
        updateData.date_finished = new Date().toISOString();
      }

      // Set date_started when starting to read
      if (newStatus === 'reading' && !book.date_started) {
        updateData.date_started = new Date().toISOString();
      }

      const { error } = await supabase
        .from('books')
        .update(updateData)
        .eq('id', book.id);

      if (error) throw error;

      setBook({ ...book, ...updateData, status: newStatus });
      toast.success(`Book marked as ${newStatus.replace('_', ' ')}`);
    } catch (error: any) {
      console.error('Error updating book status:', error);
      toast.error("Failed to update book status");
    }
  };

  const handleDeleteBook = async () => {
    if (!book) return;
    
    if (!confirm("Are you sure you want to delete this book?")) return;

    try {
      const { error } = await supabase
        .from('books')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', book.id);

      if (error) throw error;

      toast.success("Book deleted successfully");
      navigate("/dashboard");
    } catch (error: any) {
      console.error('Error deleting book:', error);
      toast.error("Failed to delete book");
    }
  };

  const handleProgressLogged = () => {
    refetchLogs();
    refetchProgress();
    loadBookData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading book details...</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Book not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="border-border/50 hover:shadow-soft transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Book Details Tabs */}
        <Card className="bg-gradient-card shadow-medium border-0 mb-6 animate-scale-in">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="journal">Journal</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="p-6 space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-foreground">{book.title}</h2>
                {book.author && <p className="text-muted-foreground">by {book.author}</p>}
              </div>

              {book.description && (
                <div className="pb-4 border-b space-y-2">
                  <span className="text-sm text-muted-foreground font-medium flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    Description
                  </span>
                  <p className="text-sm text-foreground/80 leading-relaxed">{book.description}</p>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Genre:</span>
                <Badge variant="secondary">{book.genre || "Unknown"}</Badge>
              </div>
              
              {book.pages && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Pages:</span>
                    <span className="font-medium">{book.pages}</span>
                  </div>
                  
                  {book.current_page !== null && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress:</span>
                        <span className="font-medium">
                          {book.current_page} / {book.pages} ({Math.round((book.current_page / book.pages) * 100)}%)
                        </span>
                      </div>
                      <Progress value={(book.current_page / book.pages) * 100} />
                    </div>
                  )}
                </>
              )}

              {book.rating && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Rating:</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < book.rating! ? 'fill-primary text-primary' : 'text-muted'}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge 
                  variant={book.status === 'completed' ? 'default' : 'secondary'}
                  className={book.status === 'reading' ? 'bg-orange-500 text-white' : ''}
                >
                  {book.status.replace('_', ' ')}
                </Badge>
              </div>

              {book.date_started && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Started:</span>
                  <span className="font-medium">{new Date(book.date_started).toLocaleDateString()}</span>
                </div>
              )}

              {book.date_finished && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Finished:</span>
                  <span className="font-medium">{new Date(book.date_finished).toLocaleDateString()}</span>
                </div>
              )}

              {book.tags && book.tags.length > 0 && (
                <div className="pt-2 border-t space-y-2">
                  <span className="text-sm text-muted-foreground block">Tags:</span>
                  <div className="flex flex-wrap gap-2">
                    {book.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {book.notes && (
                <div className="pt-2 border-t space-y-2">
                  <span className="text-sm text-muted-foreground block">Book Notes:</span>
                  <p className="text-sm whitespace-pre-wrap">{book.notes}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="progress" className="p-6 space-y-4">
              {progress ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4">
                      <div className="text-sm text-muted-foreground mb-1">Current Page</div>
                      <div className="text-2xl font-bold">{progress.current_page}</div>
                      <div className="text-xs text-muted-foreground">of {progress.total_pages}</div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-sm text-muted-foreground mb-1">Progress</div>
                      <div className="text-2xl font-bold">{progress.progress_percentage.toFixed(1)}%</div>
                      <Progress value={progress.progress_percentage} className="mt-2" />
                    </Card>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4">
                      <div className="text-sm text-muted-foreground mb-1">Reading Velocity</div>
                      <div className="text-xl font-bold">{progress.reading_velocity.overall.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">pages/hour</div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-sm text-muted-foreground mb-1">Total Time</div>
                      <div className="text-xl font-bold">{progress.total_time_hours.toFixed(1)}h</div>
                      <div className="text-xs text-muted-foreground">{progress.statistics.total_sessions} sessions</div>
                    </Card>
                  </div>

                  {progress.estimated_completion_date && (
                    <Card className="p-4 border-primary/20 bg-primary/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">Estimated Completion</div>
                          <div className="text-lg font-bold">{new Date(progress.estimated_completion_date).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground">
                            in ~{progress.estimated_days_to_completion} days
                          </div>
                        </div>
                        <Calendar className="h-8 w-8 text-primary" />
                      </div>
                    </Card>
                  )}

                  <div className="pt-4 space-y-2">
                    <h3 className="text-sm font-medium">Statistics</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">Total Logs:</span>
                        <span className="font-medium">{progress.statistics.total_logs}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">Avg Session:</span>
                        <span className="font-medium">{formatDuration(progress.statistics.avg_session_duration)}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">Longest Session:</span>
                        <span className="font-medium">{formatDuration(progress.statistics.longest_session)}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-muted/30 rounded">
                        <span className="text-muted-foreground">Recent Velocity:</span>
                        <span className="font-medium">{progress.reading_velocity.recent.toFixed(1)} p/h</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => navigate(`/book/${book.id}/progress`)}
                    className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium mt-4"
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    View Detailed Analytics
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No progress data available yet</p>
                  <p className="text-sm">Start logging your progress to see statistics</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="journal" className="p-6">
              <JournalEntriesList bookId={book.id} />
            </TabsContent>

            <TabsContent value="logs" className="p-6">
              {logs.length > 0 ? (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <ProgressLogItem key={log.id} log={log} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No progress logs yet</p>
                  <p className="text-sm">Log your reading progress to track your journey</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>

        {/* Quick Progress Widget */}
        {book.status === 'reading' && (
          <div className="mb-6">
            <QuickProgressWidget book={book} onUpdate={loadBookData} />
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => startTimer(book.id, book.title)}
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium"
            >
              <Play className="mr-2 h-4 w-4" />
              Start Timer
            </Button>
            
            <Button
              onClick={() => setShowProgressLogger(true)}
              variant="outline"
              className="border-border/50 hover:shadow-soft transition-all duration-300"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Log Progress
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {book.status !== 'completed' && (
              <Button
                onClick={() => handleStatusChange('completed')}
                variant="outline"
                className="border-border/50 hover:shadow-soft transition-all duration-300"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Done
              </Button>
            )}
            
            <Button
              onClick={() => navigate(`/edit-book/${book.id}`)}
              variant="outline"
              className="border-border/50 hover:shadow-soft transition-all duration-300"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>

          {user && (
            <AddToListDialog bookId={book.id} userId={user.id} />
          )}

          <Button
            onClick={handleDeleteBook}
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 transition-all duration-300"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Book
          </Button>
        </div>

        {/* Progress Logger Modal */}
        <ProgressLogger
          bookId={book.id}
          bookTitle={book.title}
          currentPage={book.current_page || 0}
          open={showProgressLogger}
          onOpenChange={setShowProgressLogger}
          onSuccess={handleProgressLogged}
        />

        {/* Recent Sessions */}
        {sessions.length > 0 && (
          <Card className="bg-gradient-card shadow-medium border-0 animate-fade-in">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-foreground flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                Recent Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sessions.slice(0, 5).map((session) => (
                  <div key={session.id} className="flex justify-between items-center py-2 border-b border-border/20 last:border-0">
                    <span className="text-sm text-muted-foreground">
                      {new Date(session.created_at).toLocaleDateString()}
                    </span>
                    <span className="font-medium">
                      {formatDuration(session.duration || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BookDetail;