import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBookLists } from "@/hooks/useBookLists";
import { useListBooks } from "@/hooks/useListBooks";
import { LoadingRegion, LoadingError } from "@/components/loading/LoadingRegion";
import { BookListDetailSkeleton } from "@/components/skeletons/BookDetailSkeleton";
import { Button } from "@/components/ui/button";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { AppBackButton } from "@/components/AppBackButton";
import { useUIEnvironmentValue } from "@/hooks/useUIEnvironment";
import { AddBooksToListDialog } from "@/components/AddBooksToListDialog";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { OptimizedImage } from "@/components/OptimizedImage";
import { APP_ICONS } from "@/config/iconography";
import { AppIcon } from "@/components/ui/app-icon";
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
import "@/components/library/collections.css";

interface SortableBookItemProps {
  book: Book;
  onRemove: (bookId: string) => Promise<void>;
  pending: boolean;
  reordering: boolean;
  dragging: boolean;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}

export const SortableBookItem = ({ book, onRemove, pending, reordering, dragging, index, count, onMove }: SortableBookItemProps) => {
  const [removeOpen, setRemoveOpen] = useState(false);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useSortable({ id: book.id, disabled: pending || !reordering || removeOpen });
  const removeTrigger = useRef<HTMLButtonElement>(null);
  const progress = getProgressPercentage(book);
  const hasProgress = book.status === "reading" && Boolean(book.pages);
  const navigationDisabled = pending || reordering;
  return <article ref={setNodeRef} data-book-id={book.id} data-dragging={isDragging || undefined} className="collection-book"
    style={{ transform: CSS.Transform.toString(transform), zIndex: isDragging ? 30 : undefined }}>
    <Link to={`/book/${book.id}`} className="collection-book-destination" aria-label={`Open ${book.title}`}
      aria-disabled={navigationDisabled || undefined} tabIndex={navigationDisabled ? -1 : undefined} onClick={event => { if (navigationDisabled) event.preventDefault(); }}>
      {book.cover_url ? <OptimizedImage src={book.cover_url} alt="" className="collection-book-cover" /> :
        <span className="collection-book-cover grid place-items-center bg-muted text-muted-foreground"><AppIcon icon={APP_ICONS.dashboard.coverFallback} variant="empty" size="md" /></span>}
      <div className="min-w-0">
        <h2 className="library-reading-row__title">{book.title}</h2>
        {book.author && <p className="library-reading-row__author">{book.author}</p>}
        <p className="collection-meta mt-2">{book.status === "completed" ? "Finished" : book.status === "to_read" ? "To read" : book.status === "reading" ? "Reading" : book.status.replace(/_/g, " ")}{book.genre && ` / ${book.genre}`}</p>
        {hasProgress && <div className="mt-3 space-y-2">
          <Progress value={progress} aria-label={`Reading progress for ${book.title}`} className="h-1.5" />
          <p className="text-xs text-muted-foreground">{book.current_page || 0} / {book.pages} pages ({Math.round(progress)}%)</p>
        </div>}
      </div>
    </Link>
    <div className="collection-book-actions">
      {reordering ? <div className="collection-reorder-controls" role="group" aria-label={`Arrange ${book.title}`}>
        <span className="text-xs tabular-nums text-muted-foreground">{index + 1} of {count}</span>
        <button type="button" ref={setActivatorNodeRef} className="library-icon-control collection-drag-handle" {...attributes} {...listeners}
          aria-disabled={pending || undefined} aria-label={`Move ${book.title}`}><AppIcon icon={APP_ICONS.common.drag} variant="action" /></button>
        <button type="button" className="library-text-control" aria-label={`Move ${book.title} up`} aria-disabled={pending || dragging || index === 0}
          onClick={() => { if (!pending && !dragging && index > 0) onMove(index, index - 1); }}>Move up</button>
        <button type="button" className="library-text-control" aria-label={`Move ${book.title} down`} aria-disabled={pending || dragging || index === count - 1}
          onClick={() => { if (!pending && !dragging && index < count - 1) onMove(index, index + 1); }}>Move down</button>
      </div> : <button ref={removeTrigger} type="button" className="library-text-control" disabled={pending || dragging}
        aria-label={`Remove ${book.title} from list`} aria-haspopup="dialog" aria-expanded={removeOpen} onClick={() => setRemoveOpen(true)}>Remove from list</button>}
    </div>
    <LibraryRemoveDialog open={removeOpen} onOpenChange={setRemoveOpen} returnFocusRef={removeTrigger}
      title="Remove from list?" description={`This removes "${book.title}" from this list. The book stays in your library.`}
      confirmText="Remove" cancelText="Cancel" onConfirm={() => onRemove(book.id)} />
  </article>;
};

const BookListDetailContent = () => {
  const { listId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { lists, loading: listsLoading, refreshing: listsRefreshing, loadingMore: listsLoadingMore,
    hasLoaded: listsLoaded, hasMore: hasMoreLists, loadMore: loadMoreLists, error: listsError, refetch: refetchLists } = useBookLists(user?.id);
  const { books, loading: booksLoading, refreshing: booksRefreshing, hasLoaded: booksLoaded, error: booksError, refetch } = useListBooks(listId, user?.id);
  const { toast } = useToast();
  const [sortableBooks, setSortableBooks] = useState<Book[]>([]);
  const [writePending, setWritePending] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [orderNotice, setOrderNotice] = useState("");
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

  const moveBook = async (oldIndex: number, newIndex: number) => {
    if (writeLocked.current || !listId || !reordering || oldIndex === newIndex || oldIndex < 0 || newIndex < 0 || newIndex >= sortableBooks.length) return;
    const previous = sortableBooks;
    const next = arrayMove(previous, oldIndex, newIndex);
    writeLocked.current = true;
    setWritePending(true);
    setWriteError(null);
    setOrderNotice("");
    setSortableBooks(next);
    try {
      await reorderBookListItems(listId, next.map((book, index) => ({ book_id: book.id, position: index + 1 })));
      if (!mounted.current) return;
      setOrderNotice(`${previous[oldIndex].title} moved to position ${newIndex + 1} of ${next.length}.`);
      toast({ title: "Order updated", description: "Books have been reordered" });
      void refetch();
    } catch (failure) {
      if (!mounted.current) return;
      setSortableBooks(previous);
      setWriteError(`Order was not saved. The previous order has been restored. ${failure instanceof Error ? failure.message : "Please try again."}`);
    } finally {
      writeLocked.current = false;
      if (mounted.current) setWritePending(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(false);
    if (!event.over) return;
    void moveBook(sortableBooks.findIndex(book => book.id === event.active.id), sortableBooks.findIndex(book => book.id === event.over!.id));
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
        {compactNavigation && <MobileHeader title="Book List" className="library-mobile-header" back={{ label: "Back", ariaLabel: "Go back", fallbackPath: "/lists" }} />}
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
          title="Book List"
          className="library-mobile-header"
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
          
        <div className="collection-heading">
          <div className="min-w-0 break-words">
            {compactNavigation ? <h2 className="font-display text-2xl font-bold mb-2">{list.name}</h2> : <h1 className="font-display text-3xl font-bold mb-2">{list.name}</h1>}
            {list.description && (
              <p className="font-sans text-muted-foreground">{list.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {sortableBooks.length} {sortableBooks.length === 1 ? "book" : "books"} / {list.is_public ? "Public list" : "Private list"}
            </p>
          </div>

          <button type="button" ref={headerAddTrigger} disabled={writePending || dragging || reordering} aria-haspopup="dialog" aria-expanded={addingBooks}
            className="library-filled-control"
            onClick={event => openAddBooks(event.currentTarget)}>
            <AppIcon icon={APP_ICONS.common.add} variant="action" className="shrink-0" />Add Books
          </button>
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
            <div className="collection-order-toolbar">
              <div className="min-w-0"><h2 className="font-sans font-semibold">{reordering ? "Arrange your books" : "In this collection"}</h2>
                {reordering && <p className="mt-1 text-sm text-muted-foreground">Use Move up or Move down, or drag a handle. Each move saves immediately.</p>}
              </div>
              <button type="button" className="library-text-control" disabled={writePending || dragging} aria-pressed={reordering}
                onClick={() => { setReordering(value => !value); setOrderNotice(""); }}>{reordering ? "Done reordering" : "Reorder"}</button>
            </div>
            <p role="status" className={orderNotice ? "text-sm text-muted-foreground" : "sr-only"}>{orderNotice}</p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              accessibility={{
                screenReaderInstructions: { draggable: "To pick up a book, press Space. Use the arrow keys to choose a position, then Space to drop or Escape to cancel. Move up and Move down buttons are also available." },
                announcements: {
                  onDragStart: ({ active }) => `Picked up ${sortableBooks.find(book => book.id === active.id)?.title ?? "book"}.`,
                  onDragOver: ({ active, over }) => over ? `${sortableBooks.find(book => book.id === active.id)?.title ?? "Book"}, target position ${sortableBooks.findIndex(book => book.id === over.id) + 1} of ${sortableBooks.length}.` : "Outside a book position. Release to keep the current order.",
                  onDragEnd: ({ active, over }) => !over || active.id === over.id ? "Order unchanged." : "Book dropped. Saving the new order.",
                  onDragCancel: () => "Reordering cancelled. Order unchanged.",
                },
              }}
              onDragEnd={handleDragEnd}
              onDragStart={() => setDragging(true)}
              onDragCancel={() => setDragging(false)}
            >
              <SortableContext
                items={sortableBooks.map(book => book.id)}
                strategy={rectSortingStrategy}
              >
                <div className="collection-grid">
                  {sortableBooks.map((book, index) => (
                    <SortableBookItem
                      key={book.id}
                      book={book}
                      onRemove={handleRemoveBook}
                      pending={writePending}
                      reordering={reordering} dragging={dragging} index={index} count={sortableBooks.length} onMove={(from, to) => void moveBook(from, to)}
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
