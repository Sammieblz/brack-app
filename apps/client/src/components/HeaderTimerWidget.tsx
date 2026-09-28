import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppIcon } from "@/components/ui/app-icon";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useTimer } from "@/contexts/TimerContext";
import { APP_ICONS } from "@/config/iconography";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";
import { Skeleton } from "@/components/ui/skeleton";

export const HeaderTimerWidget = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { books, loading, refreshing, hasLoaded, error, refetchBooks } = useBooks(user?.id);
  const { isVisible, startTimer } = useTimer();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (isVisible) setOpen(false);
  }, [isVisible]);
  const readingBooks = useMemo(
    () => books.filter((book) => book.status === "reading"),
    [books],
  );

  // An active session has one control owner in the shell utility area.
  if (isVisible) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm"
          className="h-auto whitespace-normal rounded-full border-border/70 bg-card/45 px-3 shadow-none hover:bg-accent"
          aria-label="Start reading timer">
          <AppIcon icon={APP_ICONS.floatingAction.timer} variant="inline" size="sm" />
          <span className="hidden lg:inline">Start Timer</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} collisionPadding={12}
        className="max-h-[calc(var(--app-viewport-height,100dvh)-7rem)] w-[22rem] overflow-y-auto p-0">
        <TimerPickerContent loading={loading} refreshing={refreshing} hasLoaded={hasLoaded}
          error={error} onRetry={() => void refetchBooks()} readingBooks={readingBooks}
          onStartTimer={(bookId, title) => { startTimer(bookId, title); setOpen(false); }}
          onGoToLibrary={() => { setOpen(false); navigate("/my-books"); }}
          onAddBook={() => { setOpen(false); navigate("/add-book"); }} />
      </PopoverContent>
    </Popover>
  );
};

type TimerPickerContentProps = {
  loading: boolean;
  refreshing?: boolean;
  hasLoaded?: boolean;
  error?: string | null;
  onRetry?: () => void;
  readingBooks: Array<{
    id: string;
    title: string;
    author?: string | null;
    cover_url?: string | null;
    current_page?: number | null;
    pages?: number | null;
  }>;
  onStartTimer: (bookId: string, title: string) => void;
  onGoToLibrary: () => void;
  onAddBook: () => void;
};

export const TimerPickerContent = ({
  loading,
  refreshing,
  hasLoaded,
  error,
  onRetry,
  readingBooks,
  onStartTimer,
  onGoToLibrary,
  onAddBook,
}: TimerPickerContentProps) => (
  <div className="space-y-3 p-3">
    <div>
      <h3 className="font-display text-base font-semibold">Start Reading Timer</h3>
      <p className="font-sans text-xs text-muted-foreground">
        Select a book currently marked as reading.
      </p>
    </div>

    <LoadingRegion loading={loading} refreshing={refreshing} label="Loading books for the reading timer">
    {error && <LoadingError message="Reading books could not be refreshed." onRetry={onRetry} />}
    {loading ? (
      <div className="h-[min(22rem,calc(var(--app-viewport-height,100dvh)-13rem))] space-y-2 overflow-hidden pr-2" data-loading-contract="timer-picker" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => <div key={index} className="flex items-start gap-3 rounded-md border border-border/70 p-3"><Skeleton className="h-14 w-10 shrink-0" /><div className="min-w-0 flex-1 space-y-1"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></div></div>)}
      </div>
    ) : error && !hasLoaded ? null : readingBooks.length > 0 ? (
      <ScrollArea className="h-[min(22rem,calc(var(--app-viewport-height,100dvh)-13rem))] pr-2">
        <div className="space-y-2">
          {readingBooks.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => onStartTimer(book.id, book.title)}
              className="flex w-full items-start gap-3 rounded-md border border-border/70 p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="h-14 w-10 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-muted/50 text-muted-foreground">
                  <AppIcon icon={APP_ICONS.dashboard.coverFallback} variant="empty" size="md" />
                </div>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-sm font-semibold">
                  {book.title}
                </span>
                {book.author && (
                  <span className="block truncate font-serif text-xs text-muted-foreground">
                    {book.author}
                  </span>
                )}
                {typeof book.current_page === "number" && book.pages ? (
                  <span className="block font-sans text-xs text-muted-foreground">
                    Page {book.current_page} of {book.pages}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    ) : (
      <PremiumEmptyState
        asset="emptyLibrary"
        title="No reading books"
        description="Mark a book as reading to start timing from the header."
        variant="plain"
        size="compact"
        className="rounded-md border border-border/70 p-4"
        action={
          <div className="flex w-full gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onGoToLibrary}>
              Library
            </Button>
            <Button size="sm" className="flex-1" onClick={onAddBook}>
              Add Book
            </Button>
          </div>
        }
      />
    )}
    </LoadingRegion>
  </div>
);
