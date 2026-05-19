import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Drag, NavArrowDown, Refresh, Search, Xmark } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BookCardSkeleton } from "@/components/skeletons/BookCardSkeleton";
import { EmptyBooks } from "@/components/empty/EmptyBooks";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { LibraryBookshelfView } from "@/components/library/LibraryBookshelfView";
import { LibraryCarouselView } from "@/components/library/LibraryCarouselView";
import { LibraryBookCard } from "@/components/LibraryBookCard";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { NativeHeader } from "@/components/NativeHeader";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SwipeableBookCard } from "@/components/SwipeableBookCard";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReadingProfile } from "@/hooks/useReadingProfile";
import { APP_ICONS } from "@/config/iconography";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { reorderLibraryShelf } from "@/services/api/books";
import { fetchThemePreferences, upsertThemePreferences } from "@/services/api/profiles";
import { bookOperations } from "@/utils/offlineOperation";
import { getProgressPercentage } from "@/utils/bookProgress";
import { getCuratedGenres, normalizeGenre } from "@/utils/genres";
import type { Book, LibraryViewMode } from "@/types";

type StatusFilter = "all" | "reading" | "completed" | "to_read";
type SortKey =
  | "shelf_order"
  | "created_desc"
  | "updated_desc"
  | "title_asc"
  | "author_asc"
  | "progress_desc"
  | "pages_desc";

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "reading", label: "Reading" },
  { value: "completed", label: "Done" },
  { value: "to_read", label: "To Read" },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "created_desc", label: "Recently added" },
  { value: "title_asc", label: "Title" },
  { value: "author_asc", label: "Author" },
  { value: "progress_desc", label: "Progress" },
  { value: "pages_desc", label: "Page count" },
];

const VIEW_OPTIONS: Array<{
  value: LibraryViewMode;
  label: string;
  icon: typeof APP_ICONS.library.flatView;
}> = [
  { value: "flat", label: "Flat view", icon: APP_ICONS.library.flatView },
  { value: "bookshelf", label: "Bookshelf view", icon: APP_ICONS.library.bookshelfView },
  { value: "carousel", label: "Carousel view", icon: APP_ICONS.library.carouselView },
];

const timestamp = (value?: string | null) => (value ? new Date(value).getTime() : 0);

const sortBooks = (books: Book[], sortKey: SortKey) => {
  const next = [...books];

  next.sort((a, b) => {
    switch (sortKey) {
      case "updated_desc":
        return timestamp(b.updated_at) - timestamp(a.updated_at);
      case "shelf_order": {
        const aPosition = a.shelf_position ?? Number.MAX_SAFE_INTEGER;
        const bPosition = b.shelf_position ?? Number.MAX_SAFE_INTEGER;
        if (aPosition !== bPosition) return aPosition - bPosition;
        return timestamp(b.updated_at) - timestamp(a.updated_at) || timestamp(b.created_at) - timestamp(a.created_at);
      }
      case "title_asc":
        return a.title.localeCompare(b.title);
      case "author_asc":
        return (a.author || "").localeCompare(b.author || "");
      case "progress_desc":
        return getProgressPercentage(b) - getProgressPercentage(a);
      case "pages_desc":
        return (b.pages || 0) - (a.pages || 0);
      case "created_desc":
      default:
        return timestamp(b.created_at) - timestamp(a.created_at);
    }
  });

  return next;
};

const MyBooks = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const {
    books,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refetchBooks,
    removeBookLocally,
    updateBooksLocally,
  } = useBooks(user?.id);
  const { habits } = useReadingProfile(user?.id);
  const navigate = useNavigate();
  const location = useLocation();
  const highlightBookId = (location.state as { highlightBookId?: string } | null)?.highlightBookId;
  const initialSearchQuery = useMemo(() => new URLSearchParams(location.search).get("q") || "", [location.search]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [genreFilters, setGenreFilters] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("updated_desc");
  const [viewMode, setViewMode] = useState<LibraryViewMode>("flat");
  const [reorderMode, setReorderMode] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    loading: loadingMore,
    onLoadMore: loadMore,
  });

  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setViewMode("flat");
      return;
    }

    fetchThemePreferences(user.id)
      .then((preferences) => {
        if (!cancelled) {
          setViewMode(preferences?.library_view_mode ?? "flat");
        }
      })
      .catch((error) => {
        console.error("Failed to load library view preference:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (viewMode === "bookshelf") {
      setSortKey((current) => (current === "updated_desc" ? "shelf_order" : current));
      return;
    }

    setReorderMode(false);
    setSortKey((current) => (current === "shelf_order" ? "updated_desc" : current));
  }, [viewMode]);

  const libraryGenres = useMemo(
    () => getCuratedGenres([...(habits?.genres || []), ...books.map((book) => book.genre)]),
    [books, habits?.genres]
  );

  const bookStats = useMemo(() => {
    return books.reduce(
      (acc, book) => {
        acc.total += 1;
        if (book.status === "reading") acc.reading += 1;
        if (book.status === "completed") acc.completed += 1;
        if (book.status === "to_read") acc.toRead += 1;
        return acc;
      },
      { total: 0, reading: 0, completed: 0, toRead: 0 }
    );
  }, [books]);

  const filteredBooks = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const next = books.filter((book) => {
      const searchable = [
        book.title,
        book.author,
        book.isbn,
        book.genre,
        book.status?.replace("_", " "),
        book.tags?.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !normalizedSearch || searchable.includes(normalizedSearch);
      const matchesStatus = statusFilter === "all" || book.status === statusFilter;
      const normalizedGenre = normalizeGenre(book.genre);
      const matchesGenre =
        genreFilters.length === 0 || (normalizedGenre ? genreFilters.includes(normalizedGenre) : false);

      return matchesSearch && matchesStatus && matchesGenre;
    });

    return sortBooks(next, sortKey);
  }, [books, genreFilters, searchQuery, sortKey, statusFilter]);

  const defaultSortKey: SortKey = viewMode === "bookshelf" ? "shelf_order" : "updated_desc";
  const hasContentFilters =
    Boolean(searchQuery.trim()) ||
    statusFilter !== "all" ||
    genreFilters.length > 0;
  const hasActiveFilters =
    hasContentFilters ||
    sortKey !== defaultSortKey;
  const canReorderShelf =
    viewMode === "bookshelf" &&
    sortKey === "shelf_order" &&
    !hasContentFilters &&
    !loading &&
    !loadingMore &&
    !hasMore &&
    filteredBooks.length > 1;
  const reorderUnavailableReason =
    hasMore || loadingMore
      ? "Load all books before rearranging"
      : filteredBooks.length <= 1
        ? "Add more books to rearrange your shelf"
        : "Clear filters and use Shelf order to rearrange";
  const sortOptions: Array<{ value: SortKey; label: string }> =
    viewMode === "bookshelf"
      ? [{ value: "shelf_order", label: "Shelf order" }, ...SORT_OPTIONS]
      : SORT_OPTIONS;

  useEffect(() => {
    if (!canReorderShelf) {
      setReorderMode(false);
    }
  }, [canReorderShelf]);

  const handleBookClick = (bookId: string) => {
    navigate(`/book/${bookId}`);
  };

  const handleEditBook = (bookId: string) => navigate(`/edit-book/${bookId}`);

  const handleDeleteBook = async (bookId: string) => {
    const rollback = removeBookLocally(bookId);

    try {
      await bookOperations.delete(bookId);
      toast.success("Book removed");
    } catch (err: unknown) {
      rollback();
      console.error("Error deleting book:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete book");
    }
  };

  const handleStatusChange = async (bookId: string, status: string) => {
    try {
      await bookOperations.update(bookId, { status });
      toast.success(`Book marked as ${status.replace("_", " ")}`);
    } catch (err: unknown) {
      console.error("Error updating book status:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update book status");
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setGenreFilters([]);
    setSortKey(defaultSortKey);
  };

  const toggleGenre = (genre: string) => {
    setGenreFilters((prev) =>
      prev.includes(genre) ? prev.filter((item) => item !== genre) : [...prev, genre]
    );
  };

  const handleViewModeChange = (mode: LibraryViewMode) => {
    if (mode === viewMode) return;

    if (mode === "bookshelf") {
      setSortKey("shelf_order");
    } else if (sortKey === "shelf_order") {
      setSortKey("updated_desc");
    }

    setViewMode(mode);
    if (!user?.id) return;

    upsertThemePreferences(user.id, { library_view_mode: mode }).catch((error) => {
      console.error("Failed to save library view preference:", error);
      toast.error("Could not save Library view preference");
    });
  };

  const handleShelfReorder = async (nextOrder: Book[]) => {
    if (!user?.id) return;

    const timestamp = new Date().toISOString();
    const nextPositions = new Map(nextOrder.map((book, index) => [book.id, index + 1]));
    const rollback = updateBooksLocally((currentBooks) =>
      currentBooks.map((book) => {
        const shelfPosition = nextPositions.get(book.id);
        if (!shelfPosition) return book;
        return {
          ...book,
          shelf_position: shelfPosition,
          updated_at: timestamp,
        };
      })
    );

    try {
      await reorderLibraryShelf(
        nextOrder.map((book, index) => ({
          ...book,
          shelf_position: index + 1,
          updated_at: timestamp,
        }))
      );
      toast.success(navigator.onLine ? "Shelf order updated" : "Shelf order saved offline");
    } catch (error: unknown) {
      rollback();
      console.error("Failed to reorder shelf:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update shelf order");
    }
  };

  const renderReorderControl = () => {
    if (viewMode !== "bookshelf") return null;

    const tooltip = canReorderShelf
      ? reorderMode
        ? "Finish rearranging"
        : "Rearrange shelf books"
      : reorderUnavailableReason;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              size="sm"
              variant={reorderMode ? "default" : "outline"}
              disabled={!canReorderShelf}
              onClick={() => setReorderMode((current) => !current)}
              className="rounded-full"
            >
              <Drag className="mr-2 h-4 w-4" />
              {reorderMode ? "Done" : "Reorder"}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  };

  const renderViewSwitcher = () => (
    <div
      className="flex shrink-0 items-center rounded-full border border-border/60 bg-background/70 p-1"
      role="group"
      aria-label="Library view"
    >
      {VIEW_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = viewMode === option.value;

        return (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant={active ? "default" : "ghost"}
                aria-label={option.label}
                className={cn(
                  "h-9 w-9 rounded-full",
                  active ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => handleViewModeChange(option.value)}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{option.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );

  const renderStatusControls = (compact = false) => (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", compact ? "-mx-1 px-1" : "flex-wrap")}>
      {STATUS_OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={statusFilter === option.value ? "default" : "outline"}
          onClick={() => setStatusFilter(option.value)}
          className="shrink-0 rounded-full"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );

  const renderGenreFilters = () => (
    <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
      {libraryGenres.map((genre) => (
        <Button
          key={genre}
          type="button"
          size="sm"
          variant={genreFilters.includes(genre) ? "default" : "outline"}
          onClick={() => toggleGenre(genre)}
          className="rounded-full text-xs"
        >
          {genre}
        </Button>
      ))}
    </div>
  );

  const renderFilterSheet = () => (
    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full">
          <APP_ICONS.library.filter className="mr-2 h-4 w-4" />
          Filters
          {genreFilters.length > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
              {genreFilters.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Library filters</SheetTitle>
          <SheetDescription>Refine by status, genre, and sort order.</SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-5">
          <section className="space-y-2">
            <h3 className="font-sans text-sm font-semibold">Status</h3>
            {renderStatusControls(true)}
          </section>

          <section className="space-y-2">
            <h3 className="font-sans text-sm font-semibold">Genres</h3>
            {renderGenreFilters()}
          </section>

          <section className="space-y-2">
            <h3 className="font-sans text-sm font-semibold">Sort</h3>
            <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={clearFilters} disabled={!hasActiveFilters}>
              Clear
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Apply</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  const renderSummaryChips = () => {
    const chips = [
      { label: "Total", value: bookStats.total, className: "text-primary" },
      { label: "Reading", value: bookStats.reading, className: "text-blue-500" },
      { label: "Done", value: bookStats.completed, className: "text-green-500" },
      { label: "To Read", value: bookStats.toRead, className: "text-orange-500" },
    ];

    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {chips.map((chip) => (
          <div
            key={chip.label}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-card/70 px-3 py-2"
          >
            <span className="font-sans text-xs text-muted-foreground">{chip.label}</span>
            <span className={cn("font-sans text-lg font-bold", chip.className)}>{chip.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderToolbar = () => (
    <div className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search title, author, ISBN, genre, tags..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="min-h-[44px] rounded-full pl-10 pr-10"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <Xmark className="h-4 w-4" />
            </button>
          )}
        </div>

        {isMobile ? (
          <div className="flex items-center justify-between gap-2">
            {renderViewSwitcher()}
            {renderReorderControl()}
            {renderFilterSheet()}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {renderViewSwitcher()}
            {renderReorderControl()}
            <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
              <SelectTrigger className="h-11 w-[180px] rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={clearFilters} disabled={!hasActiveFilters}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {renderStatusControls(isMobile)}

      {!isMobile && (
        <Collapsible open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
          <div className="flex flex-wrap items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="rounded-full">
                <APP_ICONS.library.filter className="mr-2 h-4 w-4" />
                Genres
                {genreFilters.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                    {genreFilters.length}
                  </span>
                )}
                <NavArrowDown
                  className={cn(
                    "ml-1 h-4 w-4 transition-transform",
                    advancedFiltersOpen && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>

            {genreFilters.length > 0 && !advancedFiltersOpen && (
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                {genreFilters.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="truncate rounded-full bg-primary/10 px-2.5 py-1 font-sans text-xs text-primary"
                  >
                    {genre}
                  </span>
                ))}
                {genreFilters.length > 3 && (
                  <span className="font-sans text-xs text-muted-foreground">
                    +{genreFilters.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>

          <CollapsibleContent className="pt-3 data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="rounded-lg border border-border/50 bg-background/45 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Genre filters
                </span>
                {genreFilters.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setGenreFilters([])}
                    className="h-7 px-2 text-xs"
                  >
                    Clear genres
                  </Button>
                )}
              </div>
              {renderGenreFilters()}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );

  const renderBooksList = () => {
    if (loading) {
      return (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          <BookCardSkeleton />
          <BookCardSkeleton />
          <BookCardSkeleton />
        </div>
      );
    }

    if (filteredBooks.length === 0) {
      return books.length === 0 ? (
        <EmptyBooks />
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <APP_ICONS.library.emptyResults className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 font-sans font-semibold">No books found</h3>
            <p className="font-sans text-sm text-muted-foreground">
              Try changing your search, status, genre, or sort filters.
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    const loadMoreMarker = hasMore ? (
      <div ref={loadMoreRef} className="py-8 flex justify-center md:col-span-2 2xl:col-span-3">
        {loadingMore && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Refresh className="h-5 w-5 animate-spin" />
            <span>Loading more...</span>
          </div>
        )}
      </div>
    ) : null;

    if (viewMode === "bookshelf") {
      return (
        <>
          <LibraryBookshelfView
            books={filteredBooks}
            userId={user?.id}
            highlightedBookId={highlightBookId}
            onView={handleBookClick}
            onEdit={handleEditBook}
            onDelete={handleDeleteBook}
            reorderMode={reorderMode}
            onReorder={handleShelfReorder}
          />
          {loadMoreMarker}
        </>
      );
    }

    if (viewMode === "carousel") {
      return (
        <>
          <LibraryCarouselView
            books={filteredBooks}
            userId={user?.id}
            highlightedBookId={highlightBookId}
            onView={handleBookClick}
            onEdit={handleEditBook}
            onDelete={handleDeleteBook}
          />
          {loadMoreMarker}
        </>
      );
    }

    return (
      <>
        <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-2 2xl:grid-cols-3")}>
          {filteredBooks.map((book) => {
            const card = (
              <LibraryBookCard
                key={book.id}
                book={book}
                userId={user?.id}
                highlighted={book.id === highlightBookId}
                onView={handleBookClick}
                onEdit={handleEditBook}
                onDelete={handleDeleteBook}
              />
            );

            if (!isMobile) return card;

            return (
              <SwipeableBookCard
                key={book.id}
                book={book}
                onView={handleBookClick}
                onEdit={handleEditBook}
                onDelete={handleDeleteBook}
                onStatusChange={handleStatusChange}
              >
                {card}
              </SwipeableBookCard>
            );
          })}
        </div>
        {loadMoreMarker}
      </>
    );
  };

  return (
    <MobileLayout>
      <PullToRefresh onRefresh={async () => await refetchBooks()}>
        {isMobile ? (
          <MobileHeader
            title="Library"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate("/analytics")}>
                <APP_ICONS.library.analytics className="h-4 w-4" />
              </Button>
            }
          />
        ) : (
          <NativeHeader
            title="My Library"
            subtitle="Manage your personal collection"
            showUtilityActions
            action={
              <div className="flex flex-wrap justify-end gap-2">
                <Button onClick={() => navigate("/book-lists")} variant="outline" size="sm">
                  <APP_ICONS.library.bookLists className="h-4 w-4 lg:mr-2" />
                  <span className="hidden lg:inline">Book Lists</span>
                </Button>
                <Button onClick={() => navigate("/analytics")} variant="outline" size="sm">
                  <APP_ICONS.library.analytics className="h-4 w-4 lg:mr-2" />
                  <span className="hidden lg:inline">Analytics</span>
                </Button>
                <Button onClick={() => navigate("/add-book")} size="sm">
                  <APP_ICONS.library.addBook className="h-4 w-4 lg:mr-2" />
                  <span className="hidden lg:inline">Add Book</span>
                </Button>
              </div>
            }
            scrollContainerId="library-scroll"
          />
        )}

        <main id="library-scroll" className="app-page space-y-4 md:space-y-6">
          {renderSummaryChips()}
          {renderToolbar()}
          {renderBooksList()}
        </main>
      </PullToRefresh>

      {isMobile && <FloatingActionButton />}
    </MobileLayout>
  );
};

export default MyBooks;
