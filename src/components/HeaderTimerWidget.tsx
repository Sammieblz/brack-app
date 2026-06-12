import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppIcon } from "@/components/ui/app-icon";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useTimer } from "@/contexts/TimerContext";
import { formatTime } from "@/utils";
import { cn } from "@/lib/utils";
import { APP_ICONS } from "@/config/iconography";

export const HeaderTimerWidget = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPhone } = useBreakpoint();
  const { books, loading } = useBooks(user?.id);
  const {
    time,
    isRunning,
    isVisible,
    bookTitle,
    startTimer,
    pauseTimer,
    resumeTimer,
    finishTimer,
    cancelTimer,
  } = useTimer();
  const [open, setOpen] = useState(false);

  const readingBooks = useMemo(
    () => books.filter((book) => book.status === "reading"),
    [books]
  );

  if (isPhone) return null;

  const handleStartTimer = (bookId: string, title: string) => {
    startTimer(bookId, title);
    setOpen(false);
  };

  const handleFinish = () => {
    void finishTimer();
    setOpen(false);
  };

  if (!isVisible) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-border/70 bg-card/45 px-3 shadow-none hover:bg-accent"
            title="Start reading timer"
          >
            <AppIcon icon={APP_ICONS.floatingAction.timer} variant="inline" size="sm" />
            <span className="hidden lg:inline">Start Timer</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="max-h-[calc(var(--app-viewport-height,100dvh)-7rem)] w-[22rem] overflow-hidden p-0"
        >
          <TimerPickerContent
            loading={loading}
            readingBooks={readingBooks}
            onStartTimer={handleStartTimer}
            onGoToLibrary={() => {
              setOpen(false);
              navigate("/my-books");
            }}
            onAddBook={() => {
              setOpen(false);
              navigate("/add-book");
            }}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex min-w-0 items-center rounded-full border border-primary/30 bg-primary/10 text-primary shadow-none">
        <div className="hidden min-w-0 items-center gap-2 pl-3 pr-2 xl:flex">
          <AppIcon
            icon={APP_ICONS.floatingAction.timer}
            variant="inline"
            size="sm"
            className={cn(isRunning && "animate-pulse")}
          />
          <span className="max-w-36 truncate font-sans text-sm font-medium">
            {bookTitle || "Reading Timer"}
          </span>
        </div>
        <span className="px-3 font-mono text-sm font-bold tabular-nums xl:px-2">
          {formatTime(time)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={isRunning ? pauseTimer : resumeTimer}
          className="h-9 w-9 min-h-9 min-w-9 rounded-full text-primary hover:bg-primary/15 hover:text-primary"
          aria-label={isRunning ? "Pause timer" : "Resume timer"}
          title={isRunning ? "Pause timer" : "Resume timer"}
        >
          <AppIcon icon={isRunning ? APP_ICONS.common.pause : APP_ICONS.common.play} variant="action" />
        </Button>
        {time > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleFinish}
            className="hidden h-9 w-9 min-h-9 min-w-9 rounded-full text-primary hover:bg-primary/15 hover:text-primary lg:inline-flex"
            aria-label="Finish timer"
            title="Finish timer"
          >
            <AppIcon icon={APP_ICONS.common.stop} variant="action" />
          </Button>
        )}
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 min-h-9 min-w-9 rounded-full text-primary hover:bg-primary/15 hover:text-primary"
            aria-label="Open timer details"
            title="Open timer details"
          >
            <AppIcon icon={APP_ICONS.floatingAction.timer} variant="action" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="max-h-[calc(var(--app-viewport-height,100dvh)-7rem)] w-[23rem] overflow-hidden p-0"
      >
        <TimerControlsContent
          time={time}
          isRunning={isRunning}
          bookTitle={bookTitle}
          onToggleRunning={isRunning ? pauseTimer : resumeTimer}
          onFinish={handleFinish}
          onCancel={() => {
            cancelTimer();
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

type TimerPickerContentProps = {
  loading: boolean;
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

const TimerPickerContent = ({
  loading,
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

    {loading ? (
      <div className="space-y-2">
        <div className="h-14 rounded-md bg-muted animate-pulse" />
        <div className="h-14 rounded-md bg-muted animate-pulse" />
      </div>
    ) : readingBooks.length > 0 ? (
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
  </div>
);

type TimerControlsContentProps = {
  time: number;
  isRunning: boolean;
  bookTitle: string | null;
  onToggleRunning: () => void;
  onFinish: () => void;
  onCancel: () => void;
};

const TimerControlsContent = ({
  time,
  isRunning,
  bookTitle,
  onToggleRunning,
  onFinish,
  onCancel,
}: TimerControlsContentProps) => (
  <div className="space-y-4 p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-display text-lg font-semibold">Reading Timer</h3>
        <p className="truncate font-sans text-sm text-muted-foreground">
          {bookTitle || "Current session"}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onCancel}
        className="h-9 w-9 min-h-9 min-w-9"
        aria-label="Cancel timer"
        title="Cancel timer"
      >
        <AppIcon icon={APP_ICONS.common.close} variant="action" />
      </Button>
    </div>

    <div className="rounded-md border border-border/70 bg-muted/20 p-4 text-center">
      <div className="font-mono text-4xl font-bold tabular-nums text-foreground">
        {formatTime(time)}
      </div>
      <p className="mt-1 font-sans text-sm text-muted-foreground">
        {isRunning ? "Reading in progress" : "Paused"}
      </p>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        onClick={onToggleRunning}
        variant={isRunning ? "outline" : "default"}
      >
        {isRunning ? (
          <>
            <AppIcon icon={APP_ICONS.common.pause} variant="inline" size="sm" className="mr-2" />
            Pause
          </>
        ) : (
          <>
            <AppIcon icon={APP_ICONS.common.play} variant="inline" size="sm" className="mr-2" />
            Resume
          </>
        )}
      </Button>
      <Button
        type="button"
        onClick={onFinish}
        variant="outline"
        disabled={time === 0}
        className="border-green-500/50 text-green-600 hover:bg-green-500/10"
      >
        <AppIcon icon={APP_ICONS.common.stop} variant="inline" size="sm" className="mr-2" />
        Finish
      </Button>
    </div>
  </div>
);
