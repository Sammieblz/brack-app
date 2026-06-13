import { useState, useEffect, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTimer } from "@/contexts/TimerContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Star } from "iconoir-react";
import { shareService } from "@/services/shareService";
import { toast } from "sonner";
import { formatDuration } from "@/utils";
import { QuickProgressWidget } from "@/components/QuickProgressWidget";
import { ProgressLogger } from "@/components/ProgressLogger";
import { ProgressLogItem } from "@/components/ProgressLogItem";
import { useProgressLogs } from "@/hooks/useProgressLogs";
import { useBookProgress } from "@/hooks/useBookProgress";
import { JournalEntriesList } from "@/components/JournalEntriesList";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { AddToListDialog } from "@/components/AddToListDialog";
import { useAuth } from "@/hooks/useAuth";
import { ReviewCard } from "@/components/social/ReviewCard";
import { ReviewForm } from "@/components/social/ReviewForm";
import { useReviews } from "@/hooks/useReviews";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { NativeHeader } from "@/components/NativeHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { APP_ICONS } from "@/config/iconography";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/utils";
import type { Book, ReadingSession } from "@/types";
import {
  fetchActiveBookById,
  fetchBookReadingSessions,
  updateBookStatus,
} from "@/services/api";
import { booksRepo, sessionsRepo } from "@/services/local";
import { bookOperations } from "@/utils/offlineOperation";

const formatStatus = (status: string) => status.replace("_", " ");

const getStatusClassName = (status: string) => {
  switch (status) {
    case "reading":
      return "bg-primary text-primary-foreground";
    case "completed":
      return "bg-emerald-500 text-white";
    case "to_read":
      return "bg-blue-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const formatDate = (date?: string | null) => {
  if (!date) return null;
  return new Date(date).toLocaleDateString();
};

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) => {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/50 py-3 last:border-0">
      <span className="font-sans text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-sans text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  );
};

const IconAction = ({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={label}
        title={label}
        onClick={onClick}
        className={cn("h-10 w-10 rounded-full border-border/70 bg-card/60 shadow-none", className)}
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

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
  const { reviews, averageRating, userHasReviewed, refetch: refetchReviews } = useReviews(id);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!id) return;
    loadBookData();
  }, [id]);

  const loadBookData = async () => {
    if (!id) return;
    
    try {
      if (!navigator.onLine) {
        const localBook = await booksRepo.get(id);
        if (!localBook) {
          toast.error("Book is not available offline yet");
          navigate("/dashboard");
          return;
        }
        setBook(localBook);
        const localSessions = (await sessionsRepo.list(user?.id || ""))
          .filter((session) => session.book_id === id);
        setSessions(localSessions);
        return;
      }

      const bookData = await fetchActiveBookById(id);
      if (!bookData) {
        toast.error("Book not found");
        navigate("/dashboard");
        return;
      }

      setBook(bookData);
      if (bookData.user_id) await booksRepo.upsertRemote(bookData.user_id, bookData);

      setSessions(await fetchBookReadingSessions(id));
    } catch (error: unknown) {
      console.error('Error loading book:', error);
      toast.error("Failed to load book details");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: 'reading' | 'completed' | 'to_read') => {
    if (!book) return;

    try {
      if (!navigator.onLine) {
        await bookOperations.update(book.id, { status: newStatus });
        setBook({ ...book, status: newStatus, updated_at: new Date().toISOString() });
        toast.success(`Book marked as ${newStatus.replace('_', ' ')}`);
        return;
      }

      const updateData = await updateBookStatus(book, newStatus);

      setBook({ ...book, ...updateData, status: newStatus });
      toast.success(`Book marked as ${newStatus.replace('_', ' ')}`);
    } catch (error: unknown) {
      console.error('Error updating book status:', error);
      toast.error("Failed to update book status");
    }
  };

  const handleDeleteBook = async () => {
    if (!book) return;

    try {
      await bookOperations.delete(book.id);

      toast.success("Book deleted successfully");
      navigate("/my-books");
    } catch (error: unknown) {
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
      <div className="flex min-h-app-viewport items-center justify-center bg-gradient-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading book details...</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex min-h-app-viewport items-center justify-center bg-gradient-background">
        <div className="text-center">
          <p className="font-sans text-muted-foreground">Book not found</p>
        </div>
      </div>
    );
  }

  const currentPage = book.current_page || 0;
  const totalPages = book.pages || 0;
  const bookProgressPercent = totalPages
    ? Math.min(100, Math.round((currentPage / totalPages) * 100))
    : 0;
  const remainingPages = totalPages ? Math.max(totalPages - currentPage, 0) : null;
  const startedDate = formatDate(book.date_started);
  const finishedDate = formatDate(book.date_finished);
  const progressValue = progress?.progress_percentage ?? bookProgressPercent;
  const statusLabel = formatStatus(book.status);

  const handleShareBook = async () => {
    try {
      await shareService.shareBook({
        title: book.title,
        author: book.author || undefined,
        isbn: book.isbn || undefined,
        coverUrl: book.cover_url || undefined,
      });
    } catch (error: unknown) {
      if (error instanceof Error && !error.message?.includes("cancelled")) {
        toast.error("Failed to share book");
      }
    }
  };

  return (
    <MobileLayout>
      {isMobile ? (
        <MobileHeader
          title={book.title}
          back={{ label: "Back", ariaLabel: "Go back", fallbackPath: "/my-books" }}
        />
      ) : (
        <NativeHeader
          title="Book Details"
          subtitle="Reading progress, notes, reviews, and actions"
          back={{ label: "Library", ariaLabel: "Back to library", fallbackPath: "/my-books" }}
          showUtilityActions
        />
      )}
      <main className="app-page space-y-5 md:space-y-6">
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-5">
            <Card className="overflow-hidden border-border/70 bg-card/80 shadow-sm animate-scale-in">
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)] md:gap-6">
                  <div className="mx-auto w-32 sm:mx-0 sm:w-36">
                    {book.cover_url ? (
                      <div className="book-3d-cover mx-auto aspect-[2/3] w-full max-w-36">
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="h-full w-full rounded-md object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-[2/3] w-full items-center justify-center rounded-md border border-border/70 bg-muted/40 text-muted-foreground">
                        <AppIcon icon={APP_ICONS.dashboard.coverFallback} variant="empty" size="xl" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div className="space-y-2 text-center sm:text-left">
                      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                        <Badge className={cn("capitalize", getStatusClassName(book.status))}>
                          {statusLabel}
                        </Badge>
                        {book.genre && <Badge variant="outline">{book.genre}</Badge>}
                        {totalPages > 0 && (
                          <span className="font-sans text-sm text-muted-foreground">
                            {totalPages} pages
                          </span>
                        )}
                      </div>
                      <h1 className="font-display text-3xl font-bold leading-tight text-foreground md:text-4xl">
                        {book.title}
                      </h1>
                      {book.author && (
                        <p className="font-serif text-lg text-muted-foreground">by {book.author}</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-border/70 bg-background/45 p-4">
                      <div className="mb-2 flex items-center justify-between gap-3 font-sans text-sm">
                        <span className="text-muted-foreground">
                          {totalPages ? `Page ${currentPage} of ${totalPages}` : "Progress"}
                        </span>
                        <span className="font-semibold text-foreground">{Math.round(progressValue)}%</span>
                      </div>
                      <Progress value={progressValue} className="h-2" />
                      <div className="mt-3 grid grid-cols-3 gap-3 text-center font-sans text-xs text-muted-foreground">
                        <div>
                          <span className="block text-base font-semibold text-foreground">{currentPage}</span>
                          Current
                        </div>
                        <div>
                          <span className="block text-base font-semibold text-foreground">
                            {remainingPages ?? "—"}
                          </span>
                          Remaining
                        </div>
                        <div>
                          <span className="block text-base font-semibold text-foreground">
                            {sessions.length}
                          </span>
                          Sessions
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="overview" className="w-full">
              <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <TabsList className="w-max min-w-full justify-start gap-1 shadow-none md:grid md:w-full md:grid-cols-5">
                  <TabsTrigger value="overview" className="flex-none px-4 md:flex-1">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="progress" className="flex-none px-4 md:flex-1">
                    Progress
                  </TabsTrigger>
                  <TabsTrigger value="reviews" className="flex-none px-4 md:flex-1">
                    Reviews
                  </TabsTrigger>
                  <TabsTrigger value="journal" className="flex-none px-4 md:flex-1">
                    Journal
                  </TabsTrigger>
                  <TabsTrigger value="logs" className="flex-none px-4 md:flex-1">
                    Logs
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <Card className="border-border/70 bg-card/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="font-display text-xl">Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="rounded-lg border border-border/60 bg-background/45 p-4">
                      {book.description ? (
                        <p className="font-serif text-sm leading-7 text-foreground/80">
                          {book.description}
                        </p>
                      ) : (
                        <p className="font-sans text-sm text-muted-foreground">
                          No description has been added for this book yet.
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg border border-border/60 bg-background/45 p-4">
                        <DetailRow label="Status" value={statusLabel} />
                        <DetailRow label="Genre" value={book.genre || "Unknown"} />
                        <DetailRow label="Pages" value={totalPages || null} />
                        <DetailRow label="ISBN" value={book.isbn} />
                      </div>

                      <div className="rounded-lg border border-border/60 bg-background/45 p-4">
                        <DetailRow label="Started" value={startedDate} />
                        <DetailRow label="Finished" value={finishedDate} />
                        {book.rating && (
                          <div className="flex items-center justify-between gap-4 border-b border-border/50 py-3 last:border-0">
                            <span className="font-sans text-sm text-muted-foreground">Rating</span>
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    "h-4 w-4",
                                    i < book.rating! ? "fill-primary text-primary" : "text-muted"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {book.tags && book.tags.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="font-sans text-sm font-medium">Tags</h3>
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
                      <div className="space-y-2 rounded-lg border border-border/60 bg-background/45 p-4">
                        <h3 className="font-sans text-sm font-medium">Book Notes</h3>
                        <p className="whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">
                          {book.notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="progress" className="mt-4 space-y-4">
                {book.status === "reading" && (
                  <QuickProgressWidget book={book} onUpdate={loadBookData} />
                )}

                {progress ? (
                  <Card className="border-border/70 bg-card/80 shadow-sm">
                    <CardHeader>
                      <CardTitle className="font-display text-xl">Reading Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border border-border/60 bg-background/45 p-4">
                          <div className="font-sans text-sm text-muted-foreground">Current Page</div>
                          <div className="font-sans text-2xl font-bold">{progress.current_page}</div>
                          <div className="font-sans text-xs text-muted-foreground">of {progress.total_pages}</div>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/45 p-4">
                          <div className="font-sans text-sm text-muted-foreground">Progress</div>
                          <div className="font-sans text-2xl font-bold">{progress.progress_percentage.toFixed(1)}%</div>
                          <Progress value={progress.progress_percentage} className="mt-2 h-1.5" />
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/45 p-4">
                          <div className="font-sans text-sm text-muted-foreground">Reading Velocity</div>
                          <div className="font-sans text-2xl font-bold">{progress.reading_velocity.overall.toFixed(1)}</div>
                          <div className="font-sans text-xs text-muted-foreground">pages/hour</div>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/45 p-4">
                          <div className="font-sans text-sm text-muted-foreground">Total Time</div>
                          <div className="font-sans text-2xl font-bold">{progress.total_time_hours.toFixed(1)}h</div>
                          <div className="font-sans text-xs text-muted-foreground">{progress.statistics.total_sessions} sessions</div>
                        </div>
                      </div>

                      {progress.estimated_completion_date && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                          <div className="font-sans text-sm text-muted-foreground">Estimated Completion</div>
                          <div className="font-sans text-lg font-bold">
                            {new Date(progress.estimated_completion_date).toLocaleDateString()}
                          </div>
                          <div className="font-sans text-xs text-muted-foreground">
                            in ~{progress.estimated_days_to_completion} days
                          </div>
                        </div>
                      )}

                      <div className="grid gap-2 font-sans text-sm sm:grid-cols-2">
                        <div className="flex justify-between rounded-md bg-muted/30 p-3">
                          <span className="text-muted-foreground">Total Logs</span>
                          <span className="font-medium">{progress.statistics.total_logs}</span>
                        </div>
                        <div className="flex justify-between rounded-md bg-muted/30 p-3">
                          <span className="text-muted-foreground">Avg Session</span>
                          <span className="font-medium">{formatDuration(progress.statistics.avg_session_duration)}</span>
                        </div>
                        <div className="flex justify-between rounded-md bg-muted/30 p-3">
                          <span className="text-muted-foreground">Longest Session</span>
                          <span className="font-medium">{formatDuration(progress.statistics.longest_session)}</span>
                        </div>
                        <div className="flex justify-between rounded-md bg-muted/30 p-3">
                          <span className="text-muted-foreground">Recent Velocity</span>
                          <span className="font-medium">{progress.reading_velocity.recent.toFixed(1)} p/h</span>
                        </div>
                      </div>

                      <Button
                        onClick={() => navigate(`/book/${book.id}/progress`)}
                        className="w-full"
                      >
                        <AppIcon icon={APP_ICONS.bookDetail.detailedAnalytics} variant="action" className="mr-2" />
                        View Detailed Analytics
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <PremiumEmptyState
                    asset="emptyProgress"
                    title="No progress data yet"
                    description="Start logging your progress to see statistics."
                    size="compact"
                  />
                )}

                {sessions.length > 0 && (
                  <Card className="border-border/70 bg-card/80 shadow-sm">
                    <CardHeader>
                      <CardTitle className="font-display text-xl">Recent Sessions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {sessions.slice(0, 5).map((session) => (
                          <div key={session.id} className="flex items-center justify-between gap-3 border-b border-border/40 py-3 last:border-0">
                            <span className="font-sans text-sm text-muted-foreground">
                              {new Date(session.created_at).toLocaleDateString()}
                            </span>
                            <span className="font-sans text-sm font-medium">
                              {formatDuration(session.duration || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="mt-4">
                <Card className="border-border/70 bg-card/80 shadow-sm">
                  <CardContent className="p-4 sm:p-6">
                    <div className="space-y-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-display text-xl font-semibold">Community Reviews</h3>
                          {averageRating && (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <div className="flex items-center">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={cn(
                                      "h-4 w-4",
                                      i < Math.round(averageRating)
                                        ? "fill-primary text-primary"
                                        : "text-muted-foreground"
                                    )}
                                  />
                                ))}
                              </div>
                              <span className="font-sans text-sm text-muted-foreground">
                                {averageRating.toFixed(1)} ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
                              </span>
                            </div>
                          )}
                        </div>
                        {!userHasReviewed && user && (
                          <Button onClick={() => setShowReviewForm(true)}>
                            Write Review
                          </Button>
                        )}
                      </div>

                      {reviews.length > 0 ? (
                        <div className="space-y-4">
                          {reviews.map((review) => (
                            <ReviewCard
                              key={review.id}
                              review={review}
                              onChanged={refetchReviews}
                            />
                          ))}
                        </div>
                      ) : (
                        <PremiumEmptyState
                          asset="emptyReviews"
                          title="No reviews yet"
                          description="Share your take once you have something useful to say about this book."
                          size="compact"
                          action={
                            !userHasReviewed && user ? (
                              <Button onClick={() => setShowReviewForm(true)}>
                                Be the first to review
                              </Button>
                            ) : undefined
                          }
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="journal" className="mt-4">
                <Card className="border-border/70 bg-card/80 shadow-sm">
                  <CardContent className="p-4 sm:p-6">
                    <JournalEntriesList bookId={book.id} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="mt-4">
                <Card className="border-border/70 bg-card/80 shadow-sm">
                  <CardContent className="p-4 sm:p-6">
                    {logs.length > 0 ? (
                      <div className="space-y-3">
                        {logs.map((log) => (
                          <ProgressLogItem key={log.id} log={log} />
                        ))}
                      </div>
                    ) : (
                      <PremiumEmptyState
                        asset="emptyProgress"
                        title="No progress logs yet"
                        description="Log your reading progress to track your journey."
                        size="compact"
                        variant="plain"
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
            <Card className="border-border/70 bg-card/85 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display text-xl">Reading Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => startTimer(book.id, book.title)}
                  className="w-full"
                >
                  <AppIcon icon={APP_ICONS.bookDetail.startTimer} variant="action" className="mr-2" />
                  Start Timer
                </Button>

                <Button
                  onClick={() => setShowProgressLogger(true)}
                  variant="outline"
                  className="w-full border-border/70 bg-background/45"
                >
                  <AppIcon icon={APP_ICONS.bookDetail.logProgress} variant="action" className="mr-2" />
                  Log Progress
                </Button>

                {book.status !== "completed" && (
                  <Button
                    onClick={() => handleStatusChange("completed")}
                    variant="outline"
                    className="w-full border-border/70 bg-background/45"
                  >
                    <AppIcon icon={APP_ICONS.common.checkCircle} variant="action" className="mr-2" />
                    Mark Done
                  </Button>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {user && (
                    <AddToListDialog
                      bookId={book.id}
                      userId={user.id}
                      triggerTooltip="Add to list"
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Add to list"
                          title="Add to list"
                          className="h-10 w-10 rounded-full border-border/70 bg-card/60 shadow-none"
                        >
                          <AppIcon icon={APP_ICONS.library.bookLists} variant="action" />
                        </Button>
                      }
                    />
                  )}
                  <IconAction label="Share book" onClick={() => void handleShareBook()}>
                    <AppIcon icon={APP_ICONS.common.share} variant="action" />
                  </IconAction>
                  <IconAction label="Edit book" onClick={() => navigate(`/edit-book/${book.id}`)}>
                    <AppIcon icon={APP_ICONS.common.edit} variant="action" />
                  </IconAction>
                  <IconAction
                    label="Delete book"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <AppIcon icon={APP_ICONS.common.delete} variant="action" />
                  </IconAction>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/85 shadow-sm">
              <CardHeader>
                <CardTitle className="font-display text-xl">At a Glance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-sans text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold">{Math.round(progressValue)}%</span>
                  </div>
                  <Progress value={progressValue} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-2 font-sans text-sm">
                  <div className="rounded-lg border border-border/60 bg-background/45 p-3">
                    <span className="block text-muted-foreground">Current</span>
                    <span className="font-semibold">{currentPage}</span>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/45 p-3">
                    <span className="block text-muted-foreground">Pages</span>
                    <span className="font-semibold">{totalPages || "—"}</span>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/45 p-3">
                    <span className="block text-muted-foreground">Started</span>
                    <span className="font-semibold">{startedDate || "—"}</span>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/45 p-3">
                    <span className="block text-muted-foreground">Sessions</span>
                    <span className="font-semibold">{sessions.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
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

        {/* Review Form Dialog */}
        {id && (
          <ReviewForm
            bookId={id}
            open={showReviewForm}
            onOpenChange={(open) => {
              setShowReviewForm(open);
              if (!open) refetchReviews();
            }}
          />
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this book?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes "{book.title}" from your library. You can re-add it later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep book</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteBook}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Book
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </MobileLayout>
  );
};

export default BookDetail;
