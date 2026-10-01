import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useParams } from "react-router-dom";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { AppBackButton } from "@/components/AppBackButton";
import { ProgressLogger } from "@/components/ProgressLogger";
import { useUIEnvironmentValue } from "@/hooks/useUIEnvironment";
import { useProgressTracking } from "@/hooks/useProgressTracking";
import { ReadingVelocityChart } from "@/components/charts/ReadingVelocityChart";
import { DailyPagesChart } from "@/components/charts/DailyPagesChart";
import { CompletionForecastChart } from "@/components/charts/CompletionForecastChart";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";
import { Skeleton } from "@/components/ui/skeleton";
import { useRetainedReaderResource } from "@/hooks/useRetainedReaderResource";
import { useAuth } from "@/hooks/useAuth";
import { APP_ICONS } from "@/config/iconography";
import { fetchActiveBookById, getBookProgress } from "@/services/api";
import { booksRepo } from "@/services/local";
import { CONNECTIVITY_STATE_EVENT, isConnectivityAvailable } from "@/services/connectivity";
import { toLocalDate } from "@/lib/dateOnly";
import { formatDuration } from "@/utils";
import "@/components/reading-progress/progress-route.css";

const subscribeToConnection = (listener: () => void) => {
  window.addEventListener(CONNECTIVITY_STATE_EVENT, listener);
  return () => window.removeEventListener(CONNECTIVITY_STATE_EVENT, listener);
};

const unavailableBook = () => Object.assign(new Error("This book is unavailable."), { status: 404 });

function ProgressTrackingContent({ id, userId, authLoading }: {
  id?: string;
  userId?: string;
  authLoading: boolean;
}) {
  const compactNavigation = useUIEnvironmentValue((environment) => environment.windowClass !== "expanded");
  const connected = useSyncExternalStore(subscribeToConnection, isConnectivityAvailable, () => true);
  const resourceId = id && userId ? `${userId}:${id}` : undefined;
  const logTrigger = useRef<HTMLButtonElement>(null);
  const [loggerOpen, setLoggerOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [visibleDays, setVisibleDays] = useState(14);
  const bookReadOwner = useRef(0);
  useLayoutEffect(() => {
    bookReadOwner.current += 1;
    return () => { bookReadOwner.current += 1; };
  }, [id, userId, connected]);
  const readBook = useCallback(async () => {
    const owner = bookReadOwner.current;
    const assertCurrent = () => {
      if (owner !== bookReadOwner.current) throw new Error("This book read is no longer current.");
    };
    const localBook = await booksRepo.get(id!);
    assertCurrent();
    if (localBook?.user_id === userId) {
      if (localBook.id !== id || localBook.deleted_at) throw unavailableBook();
      return localBook;
    }
    if (!connected || !isConnectivityAvailable()) throw new Error("This book is not available on this device.");
    const remoteBook = await fetchActiveBookById(id!);
    assertCurrent();
    if (!remoteBook || remoteBook.id !== id || remoteBook.user_id !== userId || remoteBook.deleted_at) throw unavailableBook();
    // A concurrent local page update or deletion survives remote hydration.
    const [book] = await booksRepo.upsertRemoteManyPreservingLocal(userId!, [remoteBook]);
    assertCurrent();
    if (!book || book.id !== id || book.user_id !== userId || book.deleted_at) throw unavailableBook();
    return book;
  }, [id, userId, connected]);
  const {
    data: book, loading: bookLoading, error: bookError, refetch: refetchBook,
  } = useRetainedReaderResource(resourceId, readBook);
  const {
    dailyProgress, velocityData, forecastData, loading, refreshing, error, refetch,
  } = useProgressTracking(id, userId, connected && Boolean(userId));
  const readMetrics = useCallback(() => getBookProgress(id!), [id]);
  const {
    data: progress, loading: metricsLoading, refreshing: metricsRefreshing,
    error: metricsError, refetch: refetchMetrics,
  } = useRetainedReaderResource(resourceId, readMetrics, connected);

  const refresh = useCallback(async () => {
    await Promise.all([refetchBook(), refetch(), refetchMetrics()]);
  }, [refetchBook, refetch, refetchMetrics]);

  const currentPage = book?.current_page ?? 0;
  const totalPages = book?.pages && book.pages > 0 ? book.pages : null;
  const completion = totalPages ? Math.min(100, Math.max(0, currentPage / totalPages * 100)) : null;
  const activity = [...dailyProgress].sort((a, b) => b.date.localeCompare(a.date));
  const back = { label: "Book", ariaLabel: "Back to book", to: id ? `/book/${id}` : "/my-books" };

  return (
    <MobileLayout>
      {compactNavigation && <MobileHeader title="Reading progress" back={back} />}
      <div className="app-page-narrow progress-route">
        {!compactNavigation && (
          <div className="progress-route-heading">
            <AppBackButton {...back} showLabel variant="ghost" />
            <h1>Reading progress</h1>
          </div>
        )}

        <LoadingRegion loading={bookLoading || authLoading} label="Loading this book">
          {bookLoading || authLoading ? (
            <div className="progress-route-book" aria-hidden="true" data-loading-contract="progress-book">
              <Skeleton className="h-20 w-14" />
              <div className="space-y-3"><Skeleton className="h-7 w-3/4" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-11 w-full" /></div>
            </div>
          ) : book ? (
            <section className="progress-route-reader" aria-label="Your place in this book">
              <div className="progress-route-book">
                <div className="progress-route-cover" aria-hidden="true">
                  {book.cover_url ? <img src={book.cover_url} alt="" /> : <APP_ICONS.stats.library className="h-7 w-7" />}
                </div>
                <div className="progress-route-identity">
                  <h2>{book.title}</h2>
                  {book.author && <p>{book.author}</p>}
                </div>
              </div>
              <div className="progress-route-place">
                <div className="progress-route-place-label">
                  <p><span>Your place</span><strong>Page {currentPage}{totalPages ? <small> of {totalPages}</small> : null}</strong></p>
                  {completion !== null && <span aria-hidden="true">{Math.round(completion)}%</span>}
                </div>
                {totalPages ? (
                  <progress max={totalPages} value={Math.min(currentPage, totalPages)} aria-label={`Reading progress for ${book.title}`} />
                ) : <p className="progress-route-note">Total pages not set. You can still log your place.</p>}
              </div>
              <button ref={logTrigger} type="button" className="progress-route-action progress-route-primary" onClick={() => setLoggerOpen(true)}>
                <APP_ICONS.bookDetail.logProgress className="h-5 w-5" aria-hidden="true" />
                Log progress
              </button>
            </section>
          ) : !userId ? (
            <p className="progress-route-note">Sign in to see your reading progress.</p>
          ) : (
            <LoadingError message={connected ? "This book could not be loaded. Return to your library or try again." : "This book isn't available on this device yet. Reconnect and try again."} onRetry={() => { void refetchBook(); }} />
          )}
          {book && bookError && <LoadingError message="Couldn't refresh your place. The book details already loaded remain available." onRetry={() => { void refetchBook(); }} />}
        </LoadingRegion>

        {book && (
          <section className="progress-route-activity" aria-labelledby="reading-activity-title">
            <header>
              <h2 id="reading-activity-title">Reading activity</h2>
              <p className="progress-route-note">Synced activity grouped by day. New entries appear here after syncing.</p>
            </header>
            {!connected && <p role="status" className="progress-route-notice">{dailyProgress.length ? "You're offline. Showing activity already loaded; you can still log progress on this device." : "You're offline. Reconnect to load activity and insights. You can still log progress on this device."}</p>}
            <LoadingRegion loading={loading} refreshing={refreshing} label="Loading reading activity">
              {connected && error && <LoadingError message={dailyProgress.length ? "Couldn't refresh reading activity. Previously loaded activity is still shown." : "Reading activity couldn't be loaded. You can still log progress, or try loading activity again."} onRetry={() => { void refetch(); }} />}
              {loading ? (
                <div className="progress-route-timeline" aria-hidden="true" data-loading-contract="progress-activity">
                  {[0, 1, 2].map(index => <div key={index} className="progress-route-day"><Skeleton className="h-4 w-32" /><Skeleton className="mt-2 h-6 w-40" /></div>)}
                </div>
              ) : dailyProgress.length ? (
                <>
                  <ol className="progress-route-timeline" aria-label="Daily reading activity">
                    {activity.slice(0, visibleDays).map(day => (
                      <li key={day.date} className="progress-route-day">
                        <time dateTime={day.date}>{toLocalDate(day.date)?.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) ?? day.date}</time>
                        <div><strong>{day.pages_read} {day.pages_read === 1 ? "page" : "pages"}</strong><span>{day.time_spent > 0 ? `${formatDuration(day.time_spent)} logged` : "No time logged"}</span></div>
                      </li>
                    ))}
                  </ol>
                  {activity.length > visibleDays && <button type="button" className="progress-route-action progress-route-secondary" onClick={() => setVisibleDays(count => count + 14)}>Show earlier days</button>}
                </>
              ) : connected && !error ? (
                <div className="progress-route-empty">
                  <APP_ICONS.bookDetail.logProgress className="h-7 w-7" aria-hidden="true" />
                  <h3>No synced activity yet</h3>
                  <p>Log your page above. Your reading activity will appear here after it syncs.</p>
                </div>
              ) : null}
            </LoadingRegion>

            <details className="progress-route-insights" onToggle={event => setInsightsOpen(event.currentTarget.open)}>
              <summary>Pace and insights<APP_ICONS.common.collapse className="h-5 w-5" aria-hidden="true" /></summary>
              {insightsOpen && (
                <div className="progress-route-insights-content">
                  <p className="progress-route-note">These estimates use synced reading activity and may not include your latest local changes.</p>
                  <LoadingRegion loading={metricsLoading} refreshing={metricsRefreshing} label="Loading reading insights">
                    {connected && metricsError && <LoadingError message="Reading insights couldn't be loaded. Your saved place is unaffected." onRetry={() => { void refetchMetrics(); }} />}
                    {metricsLoading ? <Skeleton className="h-24 w-full" aria-hidden="true" /> : progress ? (
                      <dl className="progress-route-metrics">
                        <div><dt>Recent pace</dt><dd>{progress.reading_velocity.recent.toFixed(1)} <span>pages/hour</span></dd></div>
                        <div><dt>Time logged</dt><dd>{progress.total_time_hours.toFixed(1)} <span>hours</span></dd></div>
                        <div><dt>Reading sessions</dt><dd>{progress.statistics.total_sessions}</dd></div>
                        <div><dt>Average session</dt><dd>{progress.statistics.avg_session_duration} <span>minutes</span></dd></div>
                        <div><dt>Days with activity</dt><dd>{dailyProgress.length}</dd></div>
                        {dailyProgress.length > 0 && <div><dt>Most pages in a day</dt><dd>{Math.max(...dailyProgress.map(day => day.pages_read))} <span>pages</span></dd></div>}
                        <div><dt>Estimated days remaining</dt><dd>{progress.estimated_days_to_completion ?? "Not enough data"}</dd></div>
                        {progress.estimated_completion_date && <div><dt>Estimated finish date</dt><dd>{toLocalDate(progress.estimated_completion_date)?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) ?? "Not enough data"}</dd></div>}
                      </dl>
                    ) : !metricsError && connected ? <p className="progress-route-note">Insights will appear when enough reading activity has synced.</p> : null}
                  </LoadingRegion>
                  {velocityData.length > 0 && <ReadingVelocityChart data={velocityData} />}
                  {dailyProgress.length > 0 && <DailyPagesChart data={dailyProgress} />}
                  {totalPages && forecastData.length > 0 && <CompletionForecastChart data={forecastData} totalPages={totalPages} />}
                </div>
              )}
            </details>
          </section>
        )}
      </div>
      {book && userId && (
        <ProgressLogger bookId={book.id} bookTitle={book.title} currentPage={currentPage} totalPages={book.pages}
          open={loggerOpen} onOpenChange={setLoggerOpen} onSuccess={refresh} returnFocusRef={logTrigger} />
      )}
    </MobileLayout>
  );
}

const ProgressTracking = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  // Resize changes presentation only; a different reader or book ends the old task.
  return <ProgressTrackingContent key={`${loading ? "auth-pending" : user?.id ?? "signed-out"}:${id ?? ""}`}
    id={id} userId={loading ? undefined : user?.id} authLoading={loading} />;
};

export default ProgressTracking;
