import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChatBubble, Search, Xmark } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppBackButton } from "@/components/AppBackButton";
import { HeaderTimerWidget } from "@/components/HeaderTimerWidget";
import { APP_ICONS } from "@/config/iconography";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import type { BackButtonConfig } from "@/hooks/useAppBack";
import { cn } from "@/lib/utils";
import { addScrollListener, getScrollParent, getScrollTop } from "@/utils/scroll";

interface NativeHeaderProps {
  title: string;
  subtitle?: string;
  back?: BackButtonConfig;
  action?: ReactNode;
  scrollContainerId?: string;
  showUtilityActions?: boolean;
}

const getBookTimestamp = (book: { updated_at?: string | null; created_at?: string | null }) => {
  const timestamp = book.updated_at || book.created_at;
  return timestamp ? new Date(timestamp).getTime() : 0;
};

const LibrarySearchAction = ({ compact = false }: { compact?: boolean }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { books, loading } = useBooks(user?.id);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const orderedBooks = [...books].sort((a, b) => getBookTimestamp(b) - getBookTimestamp(a));

    if (!normalizedQuery) {
      return orderedBooks;
    }

    return orderedBooks
      .filter((book) => {
        const searchable = [
          book.title,
          book.author,
          book.genre,
          book.isbn,
          book.status?.replace("_", " "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      });
  }, [books, query]);

  const handleSelectBook = (bookId: string) => {
    setOpen(false);
    setQuery("");
    navigate(`/book/${bookId}`);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (results.length > 0) {
      handleSelectBook(results[0].id);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={cn(
            "rounded-full border-border/70 bg-card/45 shadow-none hover:bg-accent hover:text-foreground",
            compact
              ? "xl:hidden"
              : "hidden min-w-[210px] justify-start px-4 text-muted-foreground xl:inline-flex"
          )}
          aria-label="Search library"
          title="Search library"
        >
          <Search className="h-4 w-4" />
          {!compact && <span className="font-normal">Search library</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="w-[min(24rem,calc(100vw-2rem))] overflow-hidden p-0"
      >
        <form onSubmit={handleSubmit} className="border-b border-border/70 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, author, genre"
              className="h-10 rounded-full pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear library search"
              >
                <Xmark className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </form>

        <div className="p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              <div className="h-14 animate-pulse rounded-md bg-muted" />
              <div className="h-14 animate-pulse rounded-md bg-muted" />
              <div className="h-14 animate-pulse rounded-md bg-muted" />
            </div>
          ) : books.length === 0 ? (
            <div className="p-4 text-center">
              <APP_ICONS.library.emptyResults className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-sans text-sm font-medium">No books in your library</p>
              <p className="font-sans text-xs text-muted-foreground">
                Add a book before searching your library.
              </p>
              <Button size="sm" className="mt-3" onClick={() => navigate("/add-book")}>
                Add Book
              </Button>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center">
              <APP_ICONS.library.emptyResults className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-sans text-sm font-medium">No matches found</p>
              <p className="font-sans text-xs text-muted-foreground">
                Try another title, author, or genre.
              </p>
            </div>
          ) : (
            <>
              <div className="px-2 pb-2 font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {query.trim() ? "Results" : "Recent books"}
              </div>
              <div
                className="overflow-y-auto overscroll-contain pr-2"
                style={{ maxHeight: "min(22rem, calc(var(--app-viewport-height, 100dvh) - 10rem))" }}
              >
                <div className="space-y-1">
                  {results.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => handleSelectBook(book.id)}
                      className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="h-14 w-10 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                          <APP_ICONS.dashboard.coverFallback className="h-5 w-5" />
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
                        <span className="block truncate font-sans text-xs capitalize text-muted-foreground">
                          {book.status.replace("_", " ")}
                          {book.genre ? ` · ${book.genre}` : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const HeaderUtilityActions = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-end gap-2">
      <LibrarySearchAction />
      <LibrarySearchAction compact />

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => navigate("/messages")}
        className="rounded-full border-border/70 bg-card/45 shadow-none hover:bg-accent"
        aria-label="Open messages"
        title="Messages"
      >
        <ChatBubble className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => navigate("/settings?section=notifications")}
        className="rounded-full border-border/70 bg-card/45 shadow-none hover:bg-accent"
        aria-label="Open notification settings"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
      </Button>
    </div>
  );
};

export const NativeHeader = ({
  title,
  subtitle,
  back,
  action,
  scrollContainerId,
  showUtilityActions = false,
}: NativeHeaderProps) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!scrollContainerId) return;

    const container = document.getElementById(scrollContainerId);
    if (!container) return;
    const scrollTarget = getScrollParent(container, { includeSelf: true });

    const handleScroll = () => {
      setIsScrolled(getScrollTop(scrollTarget) > 50);
    };

    handleScroll();
    return addScrollListener(scrollTarget, handleScroll, { passive: true });
  }, [scrollContainerId]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300 bg-background/95 backdrop-blur-md border-b",
        isScrolled ? "border-border shadow-sm" : "border-transparent"
      )}
    >
      <div
        className={cn(
          "app-page-header transition-all duration-300 flex items-end justify-between gap-4",
          isScrolled ? "py-3" : "py-6 pb-4"
        )}
      >
        <div className="flex flex-1 items-start gap-3 min-w-0">
          {back && (
            <AppBackButton
              {...back}
              showLabel={!isScrolled}
              className={cn(
                "mt-0 border-border/70 bg-card/45 shadow-none hover:bg-accent",
                isScrolled ? "h-10 w-10" : "h-11"
              )}
              variant="outline"
              label={back.label ?? "Back"}
            />
          )}
          <div className="min-w-0 flex-1">
            <h1
              className={cn(
                "font-display font-bold text-foreground transition-all duration-300 truncate",
                isScrolled ? "text-xl" : "text-3xl sm:text-4xl"
              )}
            >
              {title}
            </h1>
            {subtitle && !isScrolled && (
              <p className="font-sans text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        {(showUtilityActions || action) && (
          <div className="flex flex-shrink-0 items-center justify-end gap-2">
            <HeaderTimerWidget />
            {showUtilityActions && <HeaderUtilityActions />}
            {action}
          </div>
        )}
      </div>
    </header>
  );
};
