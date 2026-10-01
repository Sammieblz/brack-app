import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { LoadingRegion, LoadingError } from "@/components/loading/LoadingRegion";
import { BookDetailSkeleton } from "@/components/skeletons/BookDetailSkeleton";
import { useParams, useNavigate } from "react-router-dom";
import { useTimer } from "@/contexts/TimerContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Root as Tabs, Content as TabsContent, List as TabsList, Trigger as TabsTrigger } from "@radix-ui/react-tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BookReadingHeader } from "@/components/book-detail/BookReadingHeader";
import { LibraryRemoveDialog } from "@/components/library/LibraryRemoveDialog";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
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
} from "@/services/api";
import { booksRepo, sessionsRepo } from "@/services/local";
import { bookOperations } from "@/utils/offlineOperation";
import { isConnectivityAvailable } from "@/services/connectivity";
import { normalizeDateOnly, toLocalDate, todayDateOnly } from "@/lib/dateOnly";

const formatStatus = (status: string) => status.replace("_", " ");

const formatDate = (date?: string | null) => {
  if (!date) return null;
  const canonical = normalizeDateOnly(date);
  return toLocalDate(canonical)?.toLocaleDateString() ?? canonical;
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
      <dt className="font-sans text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-sans text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
};

const BookDetailContent = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [book, setBook] = useState<Book | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);
  const [showProgressLogger, setShowProgressLogger] = useState(false);
  const [selectedTab, setSelectedTab] = useState("overview");
  const [progressVisited, setProgressVisited] = useState(false);
  const navigate = useNavigate();
  const timer = useTimer();
  const confirm = useConfirmDialog();
  const statusLock = useRef(false);
  const ownerEpoch = useRef(0);
  const mounted = useRef(false);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const logTrigger = useRef<HTMLButtonElement>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    ownerEpoch.current += 1;
    return () => { mounted.current = false; ownerEpoch.current += 1; };
  }, []);
  const { logs, loading: logsLoading, refreshing: logsRefreshing, hasLoaded: logsLoaded, error: logsError, refetchLogs } = useProgressLogs(id);
  const { progress, refetchProgress } = useBookProgress(id, user?.id);
  const { reviews, averageRating, userHasReviewed, refetch: refetchReviews } = useReviews(id);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  const loadBookData = useCallback(async () => {
    if (!mounted.current) return;
    if (!id || authLoading || !userId) {
      setLoading(authLoading);
      if (!authLoading) setLoadError("Sign in to see this book.");
      return;
    }
    const request = ++requestId.current;
    const isCurrent = () => mounted.current && request === requestId.current;
    setLoading(true);
    setLoadError(null);
    
    try {
      const localBook = await booksRepo.get(id);
      if (!isCurrent()) return;
      const usableLocalBook = localBook && !localBook.deleted_at && localBook.user_id === userId ? localBook : null;
      if (usableLocalBook) {
        setBook(usableLocalBook);
        const localSessions = (await sessionsRepo.list(userId))
          .filter((session) => session.book_id === id);
        if (!isCurrent()) return;
        setSessions(localSessions);
      }

      if (!isConnectivityAvailable()) {
        if (!usableLocalBook) {
          setLoadError("This book isn't available on this device yet. Reconnect and try again.");
        }
        return;
      }

      const bookData = await fetchActiveBookById(id);
      if (!isCurrent()) return;
      if (!bookData || bookData.id !== id || bookData.user_id !== userId || bookData.deleted_at) {
        setLoadError("This book could not be found. Return to your library or try again.");
        return;
      }

      // A just-saved capture/correction owns the local book until sync accepts
      // it. Hydrate conditionally and render the authoritative returned record.
      const [resolvedBook] = await booksRepo.upsertRemoteManyPreservingLocal(userId, [bookData]);
      if (!isCurrent()) return;
      if (!resolvedBook || resolvedBook.id !== id || resolvedBook.user_id !== userId || resolvedBook.deleted_at) {
        setBook(null);
        setLoadError("This book could not be found. Return to your library or try again.");
        return;
      }
      setBook(resolvedBook);

      const nextSessions = await fetchBookReadingSessions(id);
      if (isCurrent()) setSessions(nextSessions);
    } catch {
      if (isCurrent()) setLoadError("We couldn't refresh this book. Any details already loaded remain available.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [authLoading, id, userId]);

  useEffect(() => {
    void loadBookData();
    return () => { requestId.current += 1; };
  }, [loadBookData]);

  const handleFinishBook = async () => {
    if (!book || authLoading || book.user_id !== user?.id || !mounted.current || statusLock.current) return;
    statusLock.current = true;
    const owner = ownerEpoch.current;
    try {
      const accepted = await confirm({ title: "Mark this book finished?",
        description: "This marks the book completed and sets its current page to the total, when known. It does not log a reading session or stop an active timer.",
        confirmText: "Mark finished", cancelText: "Keep reading" });
      if (!accepted || owner !== ownerEpoch.current) return;
      setSavingStatus(true);
      setStatusMessage(null);
      const updates: Partial<Book> = { status: "completed", updated_at: new Date().toISOString(),
        date_finished: book.date_finished || todayDateOnly(), ...(book.pages ? { current_page: book.pages } : {}) };
      await bookOperations.update(book.id, updates);
      if (owner !== ownerEpoch.current) return;
      requestId.current += 1; // An older refresh cannot overwrite this confirmed update.
      setLoading(false);
      setBook(previous => previous ? { ...previous, ...updates } : previous);
      setStatusMessage("Marked finished on this device. Changes will sync when connected.");
    } catch {
      if (owner === ownerEpoch.current) setStatusMessage("Couldn't mark this book finished. Please try again.");
    } finally {
      if (owner === ownerEpoch.current) { statusLock.current = false; setSavingStatus(false); }
    }
  };

  const handleDeleteBook = async () => {
    if (!book || authLoading || book.user_id !== user?.id || !mounted.current) return;
    const owner = ownerEpoch.current;
    try { await bookOperations.delete(book.id); }
    catch { throw new Error("Couldn't delete this book. Please try again."); }
    if (owner !== ownerEpoch.current) return;
    toast.success("Book deleted from this device. Changes will sync when connected.");
    navigate("/my-books");
  };

  const handleProgressLogged = () => Promise.all([refetchLogs(), refetchProgress(), loadBookData()]);

  if (!book) {
    return (
      <MobileLayout>
        {isMobile ? <MobileHeader title="Book Details" back={{ label: "Back", ariaLabel: "Go back", fallbackPath: "/my-books" }} /> : <NativeHeader title="Book Details" subtitle="Reading progress, notes, reviews, and actions" back={{ label: "Library", ariaLabel: "Back to library", fallbackPath: "/my-books" }} showUtilityActions />}
        <main className="app-page book-detail-page">
          <LoadingRegion loading={loading} label="Loading book details">
            {loading ? <BookDetailSkeleton /> : <LoadingError message={loadError || "This book could not be found."} onRetry={() => void loadBookData()} />}
          </LoadingRegion>
        </main>
      </MobileLayout>
    );
  }

  const totalPages = book.pages || 0;
  const startedDate = formatDate(book.date_started);
  const finishedDate = formatDate(book.date_finished);
  const statusLabel = formatStatus(book.status);
  const sameSession = timer.isVisible && timer.bookId === book.id;
  const readingLabel = sameSession ? (timer.isRunning ? "Pause reading" : "Resume reading") : "Start reading";

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
          title="Book"
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
      <main className="app-page book-detail-page">
        <LoadingRegion loading={false} refreshing={loading} label="Refreshing book details">
        {loadError && <LoadingError message={loadError} onRetry={() => void loadBookData()} className="mb-5" />}
        <div className="book-detail-layout">
          <BookReadingHeader book={book}>
            <div className="book-reading-actions">
              <button type="button" className="book-detail-control book-detail-primary"
                onClick={() => sameSession ? (timer.isRunning ? timer.pauseTimer() : timer.resumeTimer()) : timer.startTimer(book.id, book.title)}>
                <AppIcon icon={APP_ICONS.bookDetail.startTimer} variant="action" />{readingLabel}
              </button>
              <button type="button" ref={logTrigger} className="book-detail-control book-detail-secondary" onClick={() => setShowProgressLogger(true)}>
                <AppIcon icon={APP_ICONS.bookDetail.logProgress} variant="action" />Log progress
              </button>
            </div>
            {timer.isVisible && <p className="book-detail-session-note">
              {sameSession ? (timer.isRunning ? "Your reading session is running." : "Your reading session is paused.") : `Another session is open: ${timer.bookTitle}. Starting here will ask before replacing it.`}
            </p>}
            <Collapsible className="book-detail-management">
              <div className="book-detail-management-row">
                {book.status !== "completed" && <button type="button" disabled={savingStatus}
                  className="book-detail-control book-detail-text" onClick={() => void handleFinishBook()}>
                  {savingStatus ? "Saving..." : "Mark finished"}
                </button>}
                <CollapsibleTrigger asChild><button type="button" className="book-detail-control book-detail-text" aria-label={`More actions for ${book.title}`}>
                  More<AppIcon icon={APP_ICONS.common.forward} variant="action" className="rotate-90" />
                </button></CollapsibleTrigger>
              </div>
              <CollapsibleContent><div className="book-detail-menu" role="group" aria-label="Manage book">
                {user && <AddToListDialog bookId={book.id} userId={user.id}
                  trigger={<button type="button" className="book-detail-control book-detail-text"><AppIcon icon={APP_ICONS.library.bookLists} variant="action" />Add to list</button>} />}
                <button type="button" className="book-detail-control book-detail-text" onClick={() => void handleShareBook()}><AppIcon icon={APP_ICONS.common.share} variant="action" />Share book</button>
                <button type="button" className="book-detail-control book-detail-text" onClick={() => navigate(`/edit-book/${book.id}`)}><AppIcon icon={APP_ICONS.common.edit} variant="action" />Edit book</button>
                <button type="button" ref={deleteTrigger} className="book-detail-control book-detail-text book-detail-delete" aria-haspopup="dialog" aria-expanded={deleteDialogOpen}
                  disabled={savingStatus} onClick={() => setDeleteDialogOpen(true)}><AppIcon icon={APP_ICONS.common.delete} variant="action" />Delete book</button>
              </div></CollapsibleContent>
            </Collapsible>
            {statusMessage && <p role="status" className="book-detail-session-note">{statusMessage}</p>}
          </BookReadingHeader>
          <div className="book-detail-content">
            <Tabs value={selectedTab} onValueChange={value => {
              setSelectedTab(value);
              if (value === "progress") setProgressVisited(true);
            }} className="w-full">
              <TabsList className="book-detail-tabs" aria-label="Book content">
                {[["overview", "Overview"], ["progress", "Progress"], ["reviews", "Reviews"], ["journal", "Journal"], ["logs", "Logs"]].map(([value, label]) =>
                  <TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <section className="book-detail-section">
                  <header>
                    <h2>Overview</h2>
                  </header>
                  <div className="space-y-5">
                    <div className="py-2">
                      {book.description ? (
                        <p className="book-detail-description">
                          {book.description}
                        </p>
                      ) : (
                        <p className="font-sans text-sm text-muted-foreground">
                          No description has been added for this book yet.
                        </p>
                      )}
                    </div>

                    <div className="book-detail-metadata">
                      <dl className="py-2">
                        <DetailRow label="Status" value={statusLabel} />
                        <DetailRow label="Genre" value={book.genre || "Unknown"} />
                        <DetailRow label="Pages" value={totalPages || null} />
                        <DetailRow label="ISBN" value={book.isbn} />
                      </dl>

                      <dl className="py-2">
                        <DetailRow label="Started" value={startedDate} />
                        <DetailRow label="Finished" value={finishedDate} />
                        {book.rating && (
                          <div className="flex items-center justify-between gap-4 border-b border-border/50 py-3 last:border-0">
                            <dt className="font-sans text-sm text-muted-foreground">Rating</dt>
                            <dd className="flex" aria-label={`${book.rating} out of 5 stars`}>
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    "h-4 w-4",
                                    i < book.rating! ? "fill-primary text-primary" : "text-muted"
                                  )}
                                />
                              ))}
                            </dd>
                          </div>
                        )}
                      </dl>
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
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="progress" forceMount={progressVisited ? true : undefined}
                hidden={selectedTab !== "progress"} className="mt-4 space-y-4">
                {(book.status === "reading" || book.status === "completed") && (
                  <QuickProgressWidget book={book} onUpdate={loadBookData} />
                )}

                {progress ? (
                  <section className="book-detail-section">
                    <header>
                      <h2>Reading Progress</h2>
                    </header>
                    <div className="space-y-4">
                      <div className="book-detail-metrics">
                        <div>
                          <div className="font-sans text-sm text-muted-foreground">Reading Velocity</div>
                          <div className="font-sans text-2xl font-bold">{progress.reading_velocity.overall.toFixed(1)}</div>
                          <div className="font-sans text-xs text-muted-foreground">pages/hour</div>
                        </div>
                        <div className="py-2">
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
                    </div>
                  </section>
                ) : (
                  <PremiumEmptyState
                    asset="emptyProgress"
                    title="No progress data yet"
                    description="Start logging your progress to see statistics."
                    size="compact"
                  />
                )}

                {sessions.length > 0 && (
                  <section className="book-detail-section">
                    <header>
                      <h2>Recent Sessions</h2>
                    </header>
                    <div>
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
                    </div>
                  </section>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="mt-4">
                <section className="book-detail-section">
                  <div className="p-4 sm:p-6">
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
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="journal" className="mt-4">
                <section className="book-detail-section">
                  <div className="p-4 sm:p-6">
                    <JournalEntriesList bookId={book.id} />
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="logs" className="mt-4">
                <section className="book-detail-section">
                  <header>
                    <h2>Reading logs</h2>
                    <p className="font-sans text-sm text-muted-foreground">Includes logs saved on this device. Changes sync when connected.</p>
                  </header>
                  <div className="p-4 sm:p-6">
                    <LoadingRegion loading={logsLoading} refreshing={logsRefreshing}
                      label={logsLoading ? "Loading reading history" : "Reading history"} className="space-y-3">
                      {logsError && <LoadingError message={logsError} onRetry={() => void refetchLogs()} />}
                      {logsLoading && <div aria-hidden="true" className="space-y-3">
                        {[0, 1].map(item => <div key={item} className="space-y-3 rounded-lg border border-border p-4">
                          <Skeleton className="h-5 w-36" /><Skeleton className="h-5 w-24" /><Skeleton className="h-10 w-full" />
                        </div>)}
                      </div>}
                      {logs.length > 0 && <div className="space-y-3">
                        {logs.map(log => <ProgressLogItem key={log.id} log={log} />)}
                      </div>}
                      {logsLoaded && !logsLoading && !logsError && logs.length === 0 && <PremiumEmptyState
                        asset="emptyProgress"
                        title="No reading logs saved here"
                        description="Log your reading progress, or reconnect to load history from your other devices."
                        size="compact"
                        variant="plain"
                      />}
                    </LoadingRegion>
                  </div>
                </section>
              </TabsContent>
            </Tabs>
          </div>

        </div>

        {/* Progress Logger Modal */}
        <ProgressLogger
          bookId={book.id}
          bookTitle={book.title}
          currentPage={book.current_page || 0}
          totalPages={book.pages}
          open={showProgressLogger}
          onOpenChange={setShowProgressLogger}
          onSuccess={handleProgressLogged}
          returnFocusRef={logTrigger}
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

        <LibraryRemoveDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} returnFocusRef={deleteTrigger}
          title="Delete this book?" description={`This removes "${book.title}" from your library. You can re-add it later.`}
          onConfirm={handleDeleteBook} />
        </LoadingRegion>
      </main>
    </MobileLayout>
  );
};

const BookDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  return <BookDetailContent key={`${loading ? "loading" : user?.id ?? "signed-out"}:${id ?? ""}`} />;
};

export default BookDetail;
