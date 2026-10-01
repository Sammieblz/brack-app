import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LibraryViewSkeleton } from "@/components/skeletons/LibraryViewSkeleton";
import { LIBRARY_FLAT_GRID } from "@/components/library/libraryLayout";
import { LoadingRegion, LoadingError } from "@/components/loading/LoadingRegion";
import { EmptyBooks } from "@/components/empty/EmptyBooks";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { LibraryBookshelfView } from "@/components/library/LibraryBookshelfView";
import { LibraryCarouselView } from "@/components/library/LibraryCarouselView";
import { LibraryBookCard } from "@/components/LibraryBookCard";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { NativeHeader } from "@/components/NativeHeader";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SwipeableBookCard } from "@/components/SwipeableBookCard";
import { LibraryRemoveDialog } from "@/components/library/LibraryRemoveDialog";
import { AppIcon } from "@/components/ui/app-icon";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useBooks";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReadingProfile } from "@/hooks/useReadingProfile";
import { APP_ICONS } from "@/config/iconography";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { reorderLibraryShelf } from "@/services/api/books";
import { useAppBackGuard } from "@/hooks/useAppBackGuard";
import { fetchThemePreferences, upsertThemePreferences } from "@/services/api/profiles";
import { bookOperations } from "@/utils/offlineOperation";
import { getProgressPercentage } from "@/utils/bookProgress";
import { getCuratedGenres, normalizeGenre } from "@/utils/genres";
import type { Book, LibraryViewMode } from "@/types";
import { isConnectivityAvailable } from "@/services/connectivity";

import { LibraryToolbar, type LibraryStatusFilter as StatusFilter } from "@/components/library/LibraryToolbar";
type SortKey =
  | "shelf_order"
  | "created_desc"
  | "updated_desc"
  | "title_asc"
  | "author_asc"
  | "progress_desc"
  | "pages_desc";

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

const MyBooksContent = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const {
    books,
    loading,
    refreshing,
    hasLoaded,
    error,
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
  const [viewMode, setViewMode] = useState<LibraryViewMode>("flat");
  const defaultSortKey: SortKey = viewMode === "bookshelf" ? "shelf_order" : "updated_desc";
  const [filterParams, setFilterParams] = useSearchParams();
  const searchQuery = filterParams.get("q") ?? "";
  const rawStatus = filterParams.get("status");
  const statusFilter: StatusFilter = rawStatus === "reading" || rawStatus === "completed" || rawStatus === "to_read" ? rawStatus : "all";
  const genreFilters = useMemo(() => [...new Set(filterParams.getAll("genre").map(normalizeGenre).filter((genre): genre is string => Boolean(genre)))], [filterParams]);
  const requestedSort = filterParams.get("sort");
  const sortKey: SortKey = requestedSort === "shelf_order" ? defaultSortKey
    : SORT_OPTIONS.some(option => option.value === requestedSort) ? requestedSort as SortKey : defaultSortKey;
  const setFilter = (key: string, values: string[]) => setFilterParams(current => {
    const next = new URLSearchParams(current); next.delete(key);
    values.forEach(value => next.append(key, value)); return next;
  }, { replace: true, state: location.state });
  const setSearchQuery = (value: string) => setFilter("q", value ? [value] : []);
  const setStatusFilter = (value: StatusFilter) => setFilter("status", value === "all" ? [] : [value]);
  const setGenreFilters = (value: string[] | ((previous: string[]) => string[])) => setFilter("genre", typeof value === "function" ? value(genreFilters) : value);
  const setSortKey = (value: SortKey) => setFilter("sort", value === defaultSortKey ? [] : [value]);
  const [reorderMode, setReorderMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const removalPending = useRef(false);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const bulkDeleteTriggerRef = useRef<HTMLButtonElement>(null);
  const libraryContent = useRef<HTMLElement>(null);
  const [removalFocus, setRemovalFocus] = useState(0);
  useLayoutEffect(() => {
    if (removalFocus) libraryContent.current?.focus({ preventScroll: true });
  }, [removalFocus]);
  const bulkReturnFocus = useMemo(() => ({ get current() {
    return bulkDeleteTriggerRef.current?.isConnected && !bulkDeleteTriggerRef.current.disabled
      ? bulkDeleteTriggerRef.current : libraryContent.current;
  } }), []);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  const loadMoreRef = useInfiniteScroll({
    hasMore,
    loading: loadingMore,
    onLoadMore: loadMore,
  });

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
    if (viewMode !== "bookshelf") setReorderMode(false);
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

  const selectedBookIdSet = useMemo(() => new Set(selectedBookIds), [selectedBookIds]);
  const allVisibleSelected =
    filteredBooks.length > 0 && filteredBooks.every((book) => selectedBookIdSet.has(book.id));

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

  useEffect(() => {
    if (removalPending.current) return;
    const availableBookIds = new Set(books.map((book) => book.id));
    setSelectedBookIds((current) => current.filter((bookId) => availableBookIds.has(bookId)));
  }, [books]);

  useEffect(() => {
    if (removalPending.current) return;
    if (selectMode && selectedBookIds.length === 0) {
      setBulkDeleteOpen(false);
    }
  }, [selectMode, selectedBookIds.length]);

  const exitSelectMode = () => {
    if (removalPending.current) return;
    setSelectMode(false);
    setSelectedBookIds([]);
    setBulkDeleteOpen(false);
  };
  useAppBackGuard(selectMode || reorderMode, () => {
    if (removalPending.current) return false;
    exitSelectMode();
    setReorderMode(false);
    return false;
  }, 100);

  const clearSelectionForContextChange = () => {
    if (!selectMode && selectedBookIds.length === 0) return;
    exitSelectMode();
  };

  const toggleSelectedBook = (bookId: string) => {
    setSelectedBookIds((current) =>
      current.includes(bookId)
        ? current.filter((selectedBookId) => selectedBookId !== bookId)
        : [...current, bookId]
    );
  };

  const selectAllVisible = () => {
    setSelectedBookIds(filteredBooks.map((book) => book.id));
  };

  const handleSelectModeToggle = () => {
    if (selectMode) {
      exitSelectMode();
      return;
    }

    setReorderMode(false);
    setSelectMode(true);
  };

  const handleBookClick = (bookId: string) => {
    navigate(`/book/${bookId}`);
  };

  const handleEditBook = (bookId: string) => navigate(`/edit-book/${bookId}`);

  const handleDeleteBook = async (bookId: string) => {
    if (removalPending.current) throw new Error("Another removal is still being saved. Please wait.");
    removalPending.current = true;
    try {
      await bookOperations.delete(bookId);
      if (!mounted.current) return;
      removeBookLocally(bookId);
      setRemovalFocus(current => current + 1);
      toast.success("Book removed");
    } finally { removalPending.current = false; }
  };

  const handleBulkDeleteBooks = async () => {
    if (removalPending.current) return;
    const selectedIds = selectedBookIds.filter((bookId) => books.some((book) => book.id === bookId));
    if (selectedIds.length === 0) return;
    removalPending.current = true;
    try {
      const results = await Promise.allSettled(selectedIds.map(bookId => bookOperations.delete(bookId)));
      if (!mounted.current) return;
      const failedIds = selectedIds.filter((_, index) => results[index].status === "rejected");
      const removedIds = new Set(selectedIds.filter((_, index) => results[index].status === "fulfilled"));
      updateBooksLocally(current => current.filter(book => !removedIds.has(book.id)));
      setSelectedBookIds(failedIds);
      if (failedIds.length) {
        throw new Error(removedIds.size
          ? `Removed ${removedIds.size}. ${failedIds.length} could not be removed. Retry keeps only those books selected.`
          : "Couldn't remove the selected books. Your selection is kept; please try again.");
      }
      setSelectMode(false);
      setRemovalFocus(current => current + 1);
      toast.success(`Removed ${selectedIds.length} ${selectedIds.length === 1 ? "book" : "books"}`);
    } finally { removalPending.current = false; }
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
    clearSelectionForContextChange();
    setFilterParams(current => {
      const next = new URLSearchParams(current);
      ["q", "status", "genre", "sort"].forEach(key => next.delete(key));
      return next;
    }, { replace: true, state: location.state });
  };

  const toggleGenre = (genre: string) => {
    clearSelectionForContextChange();
    setGenreFilters((prev) =>
      prev.includes(genre) ? prev.filter((item) => item !== genre) : [...prev, genre]
    );
  };

  const handleViewModeChange = (mode: LibraryViewMode) => {
    if (mode === viewMode) return;

    clearSelectionForContextChange();

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
      toast.success(
        isConnectivityAvailable()
          ? "Shelf order updated"
          : "Shelf order saved offline",
      );
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
              onClick={() => {
                if (!reorderMode) exitSelectMode();
                setReorderMode((current) => !current);
                setAdvancedFiltersOpen(false);
              }}
              className="rounded-full"
            >
              <AppIcon icon={APP_ICONS.common.drag} variant="inline" size="sm" className="mr-2" />
              {reorderMode ? "Done" : "Reorder"}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  };

  const renderSelectControl = () => {
    const disabled = loading || filteredBooks.length === 0;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              type="button"
              size="sm"
              variant={selectMode ? "default" : "outline"}
              disabled={disabled}
              onClick={() => { handleSelectModeToggle(); setAdvancedFiltersOpen(false); }}
              className="rounded-full"
            >
              <AppIcon icon={APP_ICONS.common.select} variant="inline" size="sm" className="mr-2" />
              {selectMode ? "Done" : "Select"}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {disabled ? "No visible books to select" : selectMode ? "Finish selecting" : "Select multiple books"}
        </TooltipContent>
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
                aria-pressed={active}
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

  const renderGenreFilters = () => (
    <div className="flex flex-wrap gap-2">
      {libraryGenres.map((genre) => (
        <Button
          key={genre}
          type="button"
          size="sm"
          variant={genreFilters.includes(genre) ? "default" : "outline"}
          onClick={() => toggleGenre(genre)}
          aria-pressed={genreFilters.includes(genre)}
          className="h-auto whitespace-normal rounded-full text-sm"
        >
          {genre}
        </Button>
      ))}
    </div>
  );

  const renderSortSelect = (className = "h-11 w-full rounded-full") => (
    <Select
      value={sortKey}
      onValueChange={(value) => {
        clearSelectionForContextChange();
        setSortKey(value as SortKey);
      }}
    >
      <SelectTrigger aria-label="Sort books" className={className}>
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
  );

  const renderToolbar = () => (
    <LibraryToolbar search={searchQuery} onSearch={value => { clearSelectionForContextChange(); setSearchQuery(value); }}
      status={statusFilter} onStatus={value => { clearSelectionForContextChange(); setStatusFilter(value); }}
      counts={{ all: bookStats.total, reading: bookStats.reading, completed: bookStats.completed, to_read: bookStats.toRead }}
      loading={loading} controlsOpen={advancedFiltersOpen} onControlsOpen={setAdvancedFiltersOpen}
      summary={`${loading ? "Loading your books" : `${filteredBooks.length} ${filteredBooks.length === 1 ? "book" : "books"}${hasMore ? " loaded" : ""}`}${genreFilters.length ? ` - ${genreFilters.join(", ")}` : ""}${sortKey !== defaultSortKey ? ` - ${sortOptions.find(option => option.value === sortKey)?.label}` : ""}`}
      activeFilters={hasActiveFilters} onClear={clearFilters} shortcuts={<FloatingActionButton placement="inline" />}>
      <section><h3>View</h3>{renderViewSwitcher()}</section>
      <section><h3>Sort</h3>{renderSortSelect("h-auto min-h-11 w-full whitespace-normal")}</section>
      <section><div className="flex flex-wrap items-center justify-between gap-2"><h3>Genres</h3>
        {genreFilters.length > 0 && <button type="button" className="library-text-control" onClick={() => { clearSelectionForContextChange(); setGenreFilters([]); }}>Clear genres</button>}
      </div>{renderGenreFilters()}</section>
      <section><h3>Manage books</h3><div className="flex flex-wrap gap-2">{renderSelectControl()}{renderReorderControl()}</div>
        {viewMode === "bookshelf" && !canReorderShelf && <p className="font-sans text-sm text-muted-foreground">{reorderUnavailableReason}</p>}
      </section>
      <section><h3>Your reading space</h3><div className="flex flex-wrap gap-2">
        <Link to="/book-lists" className="library-text-control"><APP_ICONS.library.bookLists className="size-5" aria-hidden="true" />Book Lists</Link>
        <Link to="/analytics" className="library-text-control"><APP_ICONS.library.analytics className="size-5" aria-hidden="true" />Analytics</Link>
      </div></section>
      <button type="button" className="library-text-control" disabled={!hasActiveFilters} onClick={clearFilters}>Clear filters</button>
    </LibraryToolbar>
  );

  const renderBulkSelectionBar = () => {
    if (!selectMode) return null;

    return (
      <div className="flex flex-col gap-3 rounded-xl border border-primary/35 bg-primary/10 p-3 text-primary shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-sans text-sm font-semibold">
            {selectedBookIds.length} {selectedBookIds.length === 1 ? "book" : "books"} selected
          </p>
          <p className="font-sans text-xs text-muted-foreground">
            Bulk delete only applies to selected books currently loaded in your Library.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="library-text-control" onClick={handleSelectModeToggle}>Done</button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selectAllVisible}
            disabled={filteredBooks.length === 0 || allVisibleSelected}
            className="rounded-full"
          >
            Select all shown
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelectedBookIds([])}
            disabled={selectedBookIds.length === 0}
            className="rounded-full"
          >
            Clear
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
            ref={bulkDeleteTriggerRef}
            aria-haspopup="dialog"
            aria-expanded={bulkDeleteOpen}
            disabled={selectedBookIds.length === 0}
            className="rounded-full"
          >
            <AppIcon icon={APP_ICONS.common.delete} variant="inline" size="sm" className="mr-2" />
            Delete
          </Button>
        </div>
      </div>
    );
  };

  const renderBooksList = () => {
    if (loading) {
      return <LibraryViewSkeleton viewMode={viewMode} selectMode={selectMode} />;
    }

    if (error && !hasLoaded) return null;

    if (filteredBooks.length === 0) {
      return books.length === 0 ? (
        <EmptyBooks />
      ) : (
        <PremiumEmptyState
          asset="noResults"
          title="No books found"
          description="Try changing your search, status, genre, or sort filters."
          size="compact"
          action={
            hasActiveFilters ? (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      );
    }

    const loadMoreMarker = hasMore ? (
      <div ref={loadMoreRef} className="w-full py-8 md:col-span-2 2xl:col-span-3">
        {loadingMore && <LoadingRegion loading label="Loading more books"><LibraryViewSkeleton viewMode={viewMode} count={viewMode === "bookshelf" ? 1 : 2} /></LoadingRegion>}
      </div>
    ) : null;

    if (viewMode === "bookshelf") {
      return (
        <>
          <LibraryBookshelfView
            books={filteredBooks}
            focusFallbackRef={libraryContent}
            userId={user?.id}
            highlightedBookId={highlightBookId}
            onView={handleBookClick}
            onEdit={handleEditBook}
            onDelete={handleDeleteBook}
            reorderMode={reorderMode}
            onReorder={handleShelfReorder}
            selectMode={selectMode}
            selectedBookIds={selectedBookIds}
            onToggleSelect={toggleSelectedBook}
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
            focusFallbackRef={libraryContent}
            userId={user?.id}
            highlightedBookId={highlightBookId}
            onView={handleBookClick}
            onEdit={handleEditBook}
            onDelete={handleDeleteBook}
            selectMode={selectMode}
            selectedBookIds={selectedBookIds}
            onToggleSelect={toggleSelectedBook}
          />
          {loadMoreMarker}
        </>
      );
    }

    return (
      <>
        <div className={LIBRARY_FLAT_GRID}>
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
                selectMode={selectMode}
                selected={selectedBookIdSet.has(book.id)}
                onToggleSelect={toggleSelectedBook}
              />
            );

            return (
              <SwipeableBookCard
                key={book.id}
                enabled={isMobile && !selectMode}
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
            className="library-mobile-header"
            title="Library"
            action={
              <Button asChild size="sm" className="h-auto whitespace-normal">
                <Link to="/add-book" aria-label="Add Book"><APP_ICONS.library.addBook aria-hidden="true" className="size-4 shrink-0" />Add</Link>
              </Button>
            }
          />
        ) : (
          <NativeHeader
            title="My Library"
            subtitle="Manage your personal collection"
            showUtilityActions
            action={
              <Button asChild size="sm" className="h-auto whitespace-normal">
                <Link to="/add-book"><APP_ICONS.library.addBook aria-hidden="true" className="size-4 shrink-0" />Add Book</Link>
              </Button>
            }
          />
        )}

        <main ref={libraryContent} tabIndex={-1} aria-label="Library books" id="library-scroll" className="app-page space-y-4 md:space-y-6">
          {renderToolbar()}
          {renderBulkSelectionBar()}
          {reorderMode && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><p className="font-sans text-sm">Reorder your shelf using the handles or keyboard.</p>{renderReorderControl()}</div>}
          <LoadingRegion loading={loading} refreshing={refreshing} label={loading ? "Loading your library" : "Refreshing your library"}>
            {error && <LoadingError message={error} onRetry={() => void refetchBooks()} className="mb-4" />}
            {renderBooksList()}
          </LoadingRegion>
        </main>
      </PullToRefresh>

      <LibraryRemoveDialog
        returnFocusRef={bulkReturnFocus}
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selectedBookIds.length} selected books?`}
        description="This removes the selected books from your library. You can re-add them later."
        cancelText="Keep books"
        confirmText="Delete"
        onConfirm={handleBulkDeleteBooks}
      />

    </MobileLayout>
  );
};

const MyBooks = () => {
  const { user, loading } = useAuth();
  return <MyBooksContent key={`${user?.id ?? ""}:${loading ? "resolving" : "ready"}`} />;
};

export default MyBooks;
