import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBookLists } from "@/hooks/useBookLists";
import { useListBooks } from "@/hooks/useListBooks";
import { LoadingRegion, LoadingError } from "@/components/loading/LoadingRegion";
import { BookListDetailSkeleton } from "@/components/skeletons/BookDetailSkeleton";
import { Button } from "@/components/ui/button";
import { NavArrowRight } from "iconoir-react";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { AppBackButton } from "@/components/AppBackButton";
import { useUIEnvironmentValue } from "@/hooks/useUIEnvironment";
import { AddBooksToListDialog } from "@/components/AddBooksToListDialog";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OptimizedImage } from "@/components/OptimizedImage";
import { APP_ICONS } from "@/config/iconography";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/utils";
import { getProgressPercentage } from "@/utils/bookProgress";
import {
  removeBookFromList as removeBookFromListApi,
  reorderBookListItems,
} from "@/services/api/bookLists";
import { LibraryRemoveDialog } from "@/components/library/LibraryRemoveDialog";
import { useAppBackGuard } from "@/hooks/useAppBackGuard";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Book, BookList } from "@/types";

interface SortableBookItemProps {
  book: Book;
  onRemove: (bookId: string) => Promise<void>;
  pending?: boolean;
  onNavigate: (bookId: string) => void;
}

export const SortableBookItem = ({ book, onRemove, onNavigate, pending = false }: SortableBookItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: book.id, disabled: pending });
  const [removeOpen, setRemoveOpen] = useState(false);
  const removeTrigger = useRef<HTMLButtonElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  };
  const progress = getProgressPercentage(book);
  const hasProgress = book.status === "reading" && Boolean(book.pages);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "group h-full overflow-hidden border-border/70 bg-card/85 shadow-sm transition-all duration-200",
        isDragging && "scale-[1.015] border-primary/60 shadow-glow"
      )}
    >
      <CardContent className="flex h-full flex-col p-0">
        <div className="flex min-h-[9.5rem] flex-1 gap-3 p-3 sm:p-4">
          <button
            type="button"
            onClick={() => onNavigate(book.id)}
            className="group/cover shrink-0 text-left"
            aria-label={`Open ${book.title}`}
          >
            {book.cover_url ? (
              <OptimizedImage
                src={book.cover_url}
                alt={book.title}
                className="h-24 w-16 rounded-md object-cover shadow-sm transition-transform group-hover/cover:-translate-y-0.5 sm:h-28 sm:w-[4.5rem]"
              />
            ) : (
              <span className="grid h-24 w-16 place-items-center rounded-md bg-muted/40 text-muted-foreground sm:h-28 sm:w-[4.5rem]">
                <AppIcon icon={APP_ICONS.dashboard.coverFallback} variant="empty" size="md" />
              </span>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onNavigate(book.id)}
                className="w-full min-w-0 break-words text-left"
              >
                <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug text-foreground transition-colors hover:text-primary">
                  {book.title}
                </h3>
                {book.author && (
                  <p className="mt-0.5 truncate font-serif text-sm text-muted-foreground">
                    by {book.author}
                  </p>
                )}
              </button>

            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold capitalize text-white",
                  book.status === "completed" && "bg-green-500",
                  book.status === "reading" && "bg-orange-500",
                  book.status === "to_read" && "bg-blue-500",
                  !["completed", "reading", "to_read"].includes(book.status) && "bg-muted-foreground"
                )}
              >
                {book.status.replace("_", " ")}
              </span>
              {book.pages && (
                <span className="font-sans text-xs text-muted-foreground">
                  {book.pages} pages
                </span>
              )}
              {book.genre && (
                <span className="font-sans text-xs text-muted-foreground">
                  {book.genre}
                </span>
              )}
            </div>

            {hasProgress ? (
              <div className="mt-3 max-w-sm space-y-1.5">
                <Progress value={progress} className="h-1.5" />
                <p className="font-sans text-xs text-muted-foreground">
                  {book.current_page || 0} / {book.pages} pages ({Math.round(progress)}%)
                </p>
              </div>
            ) : (
              <p className="mt-3 font-sans text-xs text-muted-foreground">
                Tap to view details
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 border-t border-border/55 bg-background/35 px-3 py-2 sm:px-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" disabled={pending}
                aria-label={`Move ${book.title}`}
                className="h-[44px] w-[44px] touch-none cursor-grab rounded-full text-muted-foreground active:cursor-grabbing"
                {...attributes} {...listeners}>
                <AppIcon icon={APP_ICONS.common.drag} variant="action" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Drag to reorder</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(book.id)}
            className="h-auto min-h-[44px] min-w-0 justify-center whitespace-normal rounded-full px-1 text-xs"
          >
            Details
            <NavArrowRight className="h-4 w-4 shrink-0" />
          </Button>
          <Button ref={removeTrigger} type="button" variant="outline" size="icon" disabled={pending}
            aria-label={`Remove ${book.title} from list`} aria-haspopup="dialog" aria-expanded={removeOpen}
            onClick={() => setRemoveOpen(true)}
            className="h-[44px] w-[44px] rounded-full border-destructive/45 text-destructive hover:bg-destructive/10">
            <AppIcon icon={APP_ICONS.common.delete} variant="action" />
          </Button>
          <LibraryRemoveDialog open={removeOpen} onOpenChange={setRemoveOpen} returnFocusRef={removeTrigger}
            title="Remove from list?" description={`This removes "${book.title}" from this list. The book stays in your library.`}
            confirmText="Remove" cancelText="Cancel" onConfirm={() => onRemove(book.id)} />
        </div>
      </CardContent>
    </Card>
  );
};

const BookListDetailContent = () => {
  const { listId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { lists, loading: listsLoading, refreshing: listsRefreshing, loadingMore: listsLoadingMore,
    hasLoaded: listsLoaded, hasMore: hasMoreLists, loadMore: loadMoreLists, error: listsError, refetch: refetchLists } = useBookLists(user?.id);
  const { books, loading: booksLoading, refreshing: booksRefreshing, hasLoaded: booksLoaded, error: booksError, refetch } = useListBooks(listId, user?.id);
  const { toast } = useToast();
  const [sortableBooks, setSortableBooks] = useState<Book[]>([]);
  const [writePending, setWritePending] = useState(false);
  const writeLocked = useRef(false);
  const mounted = useRef(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [addingBooks, setAddingBooks] = useState(false);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const headerAddTrigger = useRef<HTMLButtonElement>(null);
  const restoreAfterRemoval = useRef(false);
  const addReturnFocus = useMemo(() => ({ get current() {
    return addTrigger.current?.isConnected ? addTrigger.current : headerAddTrigger.current;
  } }), []);
  const confirmedRemoved = useRef(new Set<string>());
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useAppBackGuard(writePending, () => false);
  useLayoutEffect(() => {
    if (!writePending && restoreAfterRemoval.current) {
      restoreAfterRemoval.current = false;
      headerAddTrigger.current?.focus();
    }
  }, [writePending, sortableBooks]);
  const compactNavigation = useUIEnvironmentValue((environment) => environment.windowClass !== "expanded"); // Must be called before any early returns

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const catalogList = lists.find(l => l.id === listId);
  const [knownList, setKnownList] = useState<BookList>();
  const catalogLookupPending = listsLoading || listsRefreshing || listsLoadingMore || (!listsError && hasMoreLists);
  const listUnavailable = !catalogList && !catalogLookupPending && (!listsError || !listsLoaded);
  // Refresh replaces the catalog with page one. Keep this route's confirmed
  // metadata (and its live tasks) while later pages reload or a read fails.
  // The keyed route owner prevents this snapshot crossing account/list scope.
  const list = catalogList ?? (!listUnavailable && listsLoaded ? knownList : undefined);
  useEffect(() => {
    if (catalogList) setKnownList(catalogList);
    else if (listUnavailable) {
      setKnownList(undefined);
      setAddingBooks(false);
    }
  }, [catalogList, listUnavailable]);
  useEffect(() => {
    if (user && !authLoading && !catalogList && !listsLoading && !listsRefreshing && !listsLoadingMore && !listsError && hasMoreLists) {
      void loadMoreLists();
    }
  }, [user, authLoading, catalogList, listsLoading, listsRefreshing, listsLoadingMore, listsError, hasMoreLists, loadMoreLists]);

  useEffect(() => {
    if (writeLocked.current) return;
    // A successful read acknowledging removal ends its temporary projection.
    // Later legitimate additions of this book must be allowed to appear.
    for (const id of confirmedRemoved.current) {
      if (!books.some(book => book.id === id)) confirmedRemoved.current.delete(id);
    }
    setSortableBooks(books.filter(book => !confirmedRemoved.current.has(book.id)));
  }, [books]);

  const handleDragEnd = async (event: DragEndEvent) => {
    if (writeLocked.current || !listId) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortableBooks.findIndex(book => book.id === active.id);
    const newIndex = sortableBooks.findIndex(book => book.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const previous = sortableBooks;
    const next = arrayMove(previous, oldIndex, newIndex);
    writeLocked.current = true;
    setWritePending(true);
    setWriteError(null);
    setSortableBooks(next);
    try {
      await reorderBookListItems(listId, next.map((book, index) => ({ book_id: book.id, position: index + 1 })));
      if (!mounted.current) return;
      toast({ title: "Order updated", description: "Books have been reordered" });
      void refetch();
    } catch (failure) {
      if (!mounted.current) return;
      setSortableBooks(previous);
      setWriteError(failure instanceof Error ? failure.message : "Couldn't reorder books. Please try again.");
    } finally {
      writeLocked.current = false;
      if (mounted.current) setWritePending(false);
    }
  };

  const handleRemoveBook = async (bookId: string) => {
    if (writeLocked.current || !listId) throw new Error("Another list change is still being saved. Please wait.");
    writeLocked.current = true;
    setWritePending(true);
    setWriteError(null);
    try {
      await removeBookFromListApi(listId, bookId);
      if (!mounted.current) return;
      confirmedRemoved.current.add(bookId);
      restoreAfterRemoval.current = true;
      setSortableBooks(current => current.filter(book => book.id !== bookId));
      toast({ title: "Book removed", description: "Book has been removed from the list" });
      void refetch();
    } finally {
      writeLocked.current = false;
      if (mounted.current) setWritePending(false);
    }
  };

  const openAddBooks = (trigger: HTMLButtonElement) => {
    if (writeLocked.current) return;
    addTrigger.current = trigger;
    setAddingBooks(true);
  };

  if (authLoading || listsLoading || booksLoading || !list || (booksError && !booksLoaded)) {
    const initialLoading = authLoading || listsLoading || booksLoading || (!list && !listsError && (hasMoreLists || listsLoadingMore));
    return (
      <MobileLayout>
        {compactNavigation && <MobileHeader title={!listsError && !booksError ? list?.name || "Book List" : "Book List"} back={{ label: "Back", ariaLabel: "Go back", fallbackPath: "/lists" }} />}
        <main className="app-page space-y-6">
          {!compactNavigation && <div><AppBackButton label="Back" ariaLabel="Go back" fallbackPath="/lists" showLabel variant="outline" className="mb-4 border-border/70 bg-card/45 shadow-none hover:bg-accent" /></div>}
          <LoadingRegion loading={initialLoading} label="Loading book list">
            {initialLoading ? <BookListDetailSkeleton count={list?.book_count} /> : <LoadingError message={listsError || booksError || "This book list could not be found."} onRetry={() => { void refetchLists(); void refetch(); }} />}
          </LoadingRegion>
        </main>
      </MobileLayout>
    );
  }

  if (!user) return null;

  return (
    <MobileLayout>
      {compactNavigation && (
        <MobileHeader
          title={list.name}
          back={{ label: "Back", ariaLabel: "Go back", fallbackPath: "/lists" }}
        />
      )}
      <main className="app-page space-y-6">
        <LoadingRegion loading={false} refreshing={listsRefreshing || listsLoadingMore || (!catalogList && catalogLookupPending) || booksRefreshing} label="Refreshing book list" className="space-y-6">
        {(listsError || booksError) && <LoadingError message={listsError || booksError!} onRetry={() => { void refetchLists(); void refetch(); }} />}
        {!compactNavigation && (
          <div>
            <AppBackButton
              label="Back"
              ariaLabel="Go back"
              fallbackPath="/lists"
              showLabel
              variant="outline"
              className="mb-4 border-border/70 bg-card/45 shadow-none hover:bg-accent"
            />
          </div>
        )}
          
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {!compactNavigation && <h1 className="font-display text-3xl font-bold mb-2">{list.name}</h1>}
            {list.description && (
              <p className="font-sans text-muted-foreground">{list.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {sortableBooks.length} {sortableBooks.length === 1 ? "book" : "books"}
            </p>
          </div>

          <Button ref={headerAddTrigger} disabled={writePending} aria-haspopup="dialog" aria-expanded={addingBooks}
            className="h-auto min-h-11 w-full whitespace-normal rounded-full sm:w-auto"
            onClick={event => openAddBooks(event.currentTarget)}>
            <AppIcon icon={APP_ICONS.common.add} variant="action" className="mr-2 shrink-0" />Add Books
          </Button>
        </div>

        {writeError && <p role="alert" className="text-sm text-destructive">{writeError}</p>}
        {writePending && <p role="status" className="text-sm text-muted-foreground">Saving your list change.</p>}
        {sortableBooks.length === 0 ? (
          <PremiumEmptyState
            asset="emptyLists"
            title="No books in this list yet"
            description="Add books to turn this into a useful collection."
            size="compact"
            action={
              <Button disabled={writePending} aria-haspopup="dialog" aria-expanded={addingBooks}
                className="h-auto min-h-11 whitespace-normal" onClick={event => openAddBooks(event.currentTarget)}>Add Books to List</Button>
            }
          />
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-3 text-sm text-muted-foreground">
              <div>
                <p className="font-sans font-semibold text-foreground">Arrange this list</p>
                <p className="font-sans">
                  Drag a book by its handle to reorder. Tap the cover or Details to open the book.
                </p>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortableBooks.map(book => book.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] items-stretch gap-4">
                  {sortableBooks.map((book) => (
                    <SortableBookItem
                      key={book.id}
                      book={book}
                      onRemove={handleRemoveBook}
                      pending={writePending}
                      onNavigate={(id) => navigate(`/book/${id}`)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
        </LoadingRegion>
      </main>
      <AddBooksToListDialog listId={listId!} userId={user.id} open={addingBooks} onOpenChange={setAddingBooks}
        trigger={null} returnFocusRef={addReturnFocus} onBooksAdded={() => { confirmedRemoved.current.clear(); void refetch(); }} />
    </MobileLayout>
  );
};

const BookListDetail = () => {
  const { listId } = useParams();
  const { user, loading } = useAuth();
  return <BookListDetailContent key={`${user?.id ?? ""}:${listId ?? ""}:${loading ? "resolving" : "ready"}`} />;
};

export default BookListDetail;
