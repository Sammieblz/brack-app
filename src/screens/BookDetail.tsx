import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTimer } from "@/contexts/TimerContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Clock, CheckCircle, Edit, Trash2, Play, Star, TrendingUp, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatDuration } from "@/utils";
import { calculateReadingVelocity, calculateEstimatedCompletion } from "@/utils/bookProgress";
import { QuickProgressWidget } from "@/components/QuickProgressWidget";
import type { Book, ReadingSession } from "@/types";

const BookDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { startTimer } = useTimer();

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
      const { error } = await supabase
        .from('books')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', book.id);

      if (error) throw error;

      setBook({ ...book, status: newStatus });
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

  const totalReadingTime = sessions.reduce((total, session) => {
    return total + (session.duration || 0);
  }, 0);

  const readingVelocity = calculateReadingVelocity(book || {} as Book, sessions);
  const estimatedCompletion = calculateEstimatedCompletion(book || {} as Book, sessions);

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

        {/* Book Details Card */}
        <Card className="bg-gradient-card shadow-medium border-0 mb-6 animate-scale-in">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold text-foreground">
              {book.title}
            </CardTitle>
            {book.author && (
              <p className="text-muted-foreground">by {book.author}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Sessions:</span>
              <span className="font-medium">{sessions.length}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Time:</span>
              <span className="font-medium">{formatDuration(totalReadingTime)}</span>
            </div>

            {readingVelocity && book.status === 'reading' && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Reading Velocity:
                </span>
                <span className="font-medium">{readingVelocity.toFixed(1)} pages/hr</span>
              </div>
            )}

            {estimatedCompletion && book.status === 'reading' && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Est. Completion:
                </span>
                <span className="font-medium">{estimatedCompletion.toLocaleDateString()}</span>
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
                <span className="text-sm text-muted-foreground block">Notes:</span>
                <p className="text-sm whitespace-pre-wrap">{book.notes}</p>
              </div>
            )}
          </CardContent>
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
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => navigate(`/edit-book/${book.id}`)}
              variant="outline"
              className="border-border/50 hover:shadow-soft transition-all duration-300"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            
            <Button
              onClick={handleDeleteBook}
              variant="outline"
              className="border-destructive/50 text-destructive hover:bg-destructive/10 transition-all duration-300"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

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