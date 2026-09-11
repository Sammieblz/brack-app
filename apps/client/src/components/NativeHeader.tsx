import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppBackButton } from "@/components/AppBackButton";
import { HeaderTimerWidget } from "@/components/HeaderTimerWidget";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { AppIcon } from "@/components/ui/app-icon";
import { APP_ICONS } from "@/config/iconography";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import type { BackButtonConfig } from "@/hooks/useAppBack";
import { cn } from "@/lib/utils";
import { useAppHeader } from "@/hooks/useAppHeader";
import { UserNotificationsPopover } from "@/components/UserNotificationsPopover";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";

interface NativeHeaderProps {
  title: string;
  subtitle?: string;
  back?: BackButtonConfig;
  action?: ReactNode;
  secondary?: ReactNode;
  showUtilityActions?: boolean;
  showTimerAction?: boolean;
}

const getBookTimestamp = (book: { updated_at?: string | null; created_at?: string | null }) => {
  const timestamp = book.updated_at || book.created_at;
  return timestamp ? new Date(timestamp).getTime() : 0;
};

const LibrarySearchAction = ({ compact = false }: { compact?: boolean }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { books, loading, refreshing, hasLoaded, error, refetchBooks } = useBooks(user?.id);
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
          <AppIcon icon={APP_ICONS.common.search} variant="action" />
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
            <AppIcon
              icon={APP_ICONS.common.search}
              variant="inline"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
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
                <AppIcon icon={APP_ICONS.common.close} variant="action" size="xs" />
              </button>
            )}
          </div>
        </form>

        <LoadingRegion loading={loading} refreshing={refreshing} label="Loading recent books" className="p-2">
          {error && <LoadingError message="Your library could not update." onRetry={refetchBooks} />}
          {loading ? (
            <div aria-hidden="true">
              <div className="px-2 pb-2 font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">{query.trim() ? "Results" : "Recent books"}</div>
              <div className="space-y-1 pr-2">{[0, 1, 2].map(index => <div key={index} className="flex w-full items-center gap-3 rounded-md p-2"><Skeleton className="h-14 w-10 shrink-0 rounded" /><div className="min-w-0 flex-1"><Skeleton className="h-[1.5em] w-3/4 text-sm" /><Skeleton className="h-[1.5em] w-1/2 text-xs" /><Skeleton className="h-[1.5em] w-2/3 text-xs" /></div></div>)}</div>
            </div>
          ) : error && !hasLoaded ? null : books.length === 0 ? (
            <PremiumEmptyState
              asset="emptyLibrary"
              title="No books in your library"
              description="Add a book before searching your library."
              variant="plain"
              size="compact"
              action={
                <Button size="sm" onClick={() => navigate("/add-book")}>
                  Add Book
                </Button>
              }
              className="p-4"
            />
          ) : results.length === 0 ? (
            <PremiumEmptyState
              asset="noResults"
              title="No matches found"
              description="Try another title, author, or genre."
              variant="plain"
              size="compact"
              className="p-4"
            />
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
        </LoadingRegion>
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
        <AppIcon icon={APP_ICONS.common.chat} variant="action" />
      </Button>

      <UserNotificationsPopover />
    </div>
  );
};

export const NativeHeader = ({
  title,
  subtitle,
  back,
  action,
  secondary,
  showUtilityActions = false,
  showTimerAction = true,
}: NativeHeaderProps) => {
  const headerRef = useAppHeader();

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-border bg-background/95 pt-[var(--app-safe-top,0px)] backdrop-blur-md"
    >
      {/* Keep the in-flow box stable while scrolling. Shrinking this sticky
          header changes scroll geometry and feeds back into scroll anchoring. */}
      <div className="app-page-header flex flex-wrap items-end justify-between gap-4 py-6 pb-4">
        <div className="flex min-w-0 flex-[1_1_14rem] items-start gap-3">
          {back && (
            <AppBackButton
              {...back}
              showLabel
              className="mt-0 h-11 border-border/70 bg-card/45 shadow-none hover:bg-accent"
              variant="outline"
              label={back.label ?? "Back"}
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl break-words">
              {title}
            </h1>
            {subtitle && (
              <p className="font-sans text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        {(showUtilityActions || action) && (
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
            {showTimerAction && <HeaderTimerWidget />}
            {showUtilityActions && <HeaderUtilityActions />}
            {action}
          </div>
        )}
      </div>
      {secondary && (
        <div className="app-page-header border-t border-border/60 py-2">
          {secondary}
        </div>
      )}
    </header>
  );
};
