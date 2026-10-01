import { type CSSProperties, type MouseEvent, type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { OptimizedImage } from "@/components/OptimizedImage";
import { LibraryBookshelfSelection } from "@/components/library/LibraryBookshelfSelection";
import { LibraryStatusBadge } from "@/components/library/LibraryBookActions";
import { AppIcon } from "@/components/ui/app-icon";
import { APP_ICONS } from "@/config/iconography";
import { useShelfColumns } from "./useShelfColumns";
import { cn } from "@/lib/utils";
import { getProgressPercentage } from "@/utils/bookProgress";
import type { Book } from "@/types";

interface LibraryBookshelfViewProps {
  books: Book[];
  userId?: string;
  highlightedBookId?: string;
  onView: (bookId: string) => void;
  onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void;
  focusFallbackRef?: RefObject<HTMLElement | null>;
  reorderMode?: boolean;
  reorderPending?: boolean;
  onReorder?: (books: Book[]) => Promise<void> | void;
  selectMode?: boolean;
  selectedBookIds?: string[];
  onToggleSelect?: (bookId: string) => void;
}

const chunkBooks = (books: Book[], chunkSize: number) => {
  const rows: Book[][] = [];
  for (let index = 0; index < books.length; index += chunkSize) {
    rows.push(books.slice(index, index + chunkSize));
  }
  return rows;
};

interface SortableShelfBookProps {
  book: Book;
  bookIndex: number;
  rowIndex: number;
  highlighted: boolean;
  reorderMode: boolean;
  reorderPending: boolean;
  position: number;
  total: number;
  onMove: (id: string, direction: number) => void;
  selectMode: boolean;
  selected: boolean;
  onSelect: (book: Book, trigger: HTMLButtonElement) => void;
  onToggleSelect?: (bookId: string) => void;
}

const SortableShelfBook = ({
  book,
  bookIndex,
  rowIndex,
  highlighted,
  reorderMode,
  reorderPending, position, total, onMove,
  selectMode,
  selected,
  onSelect,
  onToggleSelect,
}: SortableShelfBookProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: book.id, disabled: !reorderMode || reorderPending });
  const progress = getProgressPercentage(book);
  const lean = ((rowIndex + bookIndex) % 5) - 2;
  const depth = 8 + ((rowIndex + bookIndex) % 4) * 2;
  const bookStyle = {
    "--book-lean": `${lean * 0.85}deg`,
    "--book-depth": `${depth}px`,
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    zIndex: isDragging ? 40 : undefined,
  } as CSSProperties;

  const handleActivate = (event: MouseEvent<HTMLButtonElement>) => {
    // Drag activation and selection are mutually exclusive with opening a book.
    // Keeping this guard first also prevents a synthetic click after a drag.
    if (reorderMode) return;
    if (selectMode) {
      onToggleSelect?.(book.id);
      return;
    }
    // Safari does not focus buttons on pointer activation by default. Remember
    // the same native control for every input method before the preview opens.
    event.currentTarget.focus({ preventScroll: true });
    onSelect(book, event.currentTarget);
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "library-shelf-book group",
        highlighted && "library-shelf-book-highlighted",
        reorderMode && "library-shelf-book-reordering",
        selectMode && "library-shelf-book-selecting",
        selected && "library-shelf-book-selected",
        isDragging && "library-shelf-book-dragging"
      )}
      style={bookStyle}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="library-shelf-primary"
        data-library-book-id={book.id}
        {...(reorderMode ? attributes : {})}
        {...(reorderMode ? listeners : {})}
        onClick={handleActivate}
        aria-disabled={reorderMode && reorderPending ? true : undefined}
        aria-label={reorderMode ? `Move ${book.title}` : selectMode ? `Select ${book.title}` : `Open ${book.title}`}
        aria-pressed={reorderMode ? attributes["aria-pressed"] : selectMode ? selected : undefined}
        aria-haspopup={!reorderMode && !selectMode ? "dialog" : undefined}
      />
      <span className="library-shelf-book-shadow" aria-hidden="true" />
      {reorderMode && (
        <span className="library-shelf-drag-handle" aria-hidden="true">
          <AppIcon icon={APP_ICONS.common.drag} variant="inline" size="xs" />
        </span>
      )}
      <span className="library-shelf-cover" aria-hidden="true">
        {selectMode && (
          <span className="library-shelf-select-checkbox">
            <span className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full border border-primary",
              selected && "bg-primary text-primary-foreground"
            )}>
              {selected && <AppIcon icon={APP_ICONS.common.check} variant="inline" size="xs" />}
            </span>
          </span>
        )}
        <span className="library-shelf-cover-pages" aria-hidden="true" />
        <span className="library-shelf-cover-face">
          {book.cover_url ? (
            <OptimizedImage
              src={book.cover_url}
              alt=""
              className="h-full w-full rounded-[0.22rem] object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center rounded-[0.22rem] bg-muted/50 text-muted-foreground">
              <AppIcon icon={APP_ICONS.dashboard.coverFallback} variant="empty" size="lg" />
            </span>
          )}
          <span className="library-shelf-status">
            <LibraryStatusBadge status={book.status} />
          </span>
          {book.status === "reading" && Boolean(book.pages) && (
            <span className="library-shelf-progress" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
            </span>
          )}
        </span>
      </span>
      <span className="library-shelf-title">
        {book.title}
      </span>
      {book.author && <span className="library-shelf-author">{book.author}</span>}
      <span className="library-shelf-caption"><LibraryStatusBadge status={book.status} />
        {book.status === "reading" && Boolean(book.pages) && <span>{Math.round(progress)}% read</span>}
      </span>
      {reorderMode && <div className="library-shelf-moves" role="group" aria-label={`Position ${position + 1} of ${total} for ${book.title}`}>
        {[-1, 1].map(direction => <button key={direction} type="button" className="library-text-control"
          data-shelf-move={`${book.id}:${direction}`} aria-label={`Move ${book.title} ${direction < 0 ? "earlier" : "later"}`}
          aria-disabled={reorderPending || position + direction < 0 || position + direction >= total}
          onClick={() => { if (!reorderPending && position + direction >= 0 && position + direction < total) onMove(book.id, direction); }}>
          {direction < 0 ? "Earlier" : "Later"}
        </button>)}
      </div>}
    </div>
  );
};

export const LibraryBookshelfView = ({
  books,
  userId,
  highlightedBookId,
  onView,
  onEdit,
  onDelete,
  focusFallbackRef,
  reorderMode = false,
  reorderPending = false,
  onReorder,
  selectMode = false,
  selectedBookIds = [],
  onToggleSelect,
}: LibraryBookshelfViewProps) => {
  const navigate = useNavigate();
  const { shelfRef, columns: rowSize } = useShelfColumns();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const selectedBookTrigger = useRef<HTMLButtonElement | null>(null);
  const selectedTriggerId = useRef<string | null>(null);
  const [moveFocus, setMoveFocus] = useState<string | null>(null);
  const moveOwner = useRef<object | null>(null);
  useLayoutEffect(() => {
    moveOwner.current = {};
    return () => { moveOwner.current = null; };
  }, [userId]);
  useLayoutEffect(() => {
    if (!moveFocus) return;
    const target = [...(shelfRef.current?.querySelectorAll<HTMLButtonElement>("[data-shelf-move]") ?? [])].find(node => node.dataset.shelfMove === moveFocus);
    target?.focus({ preventScroll: true });
    setMoveFocus(null);
  }, [books, moveFocus, shelfRef]);
  const selectionOpen = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const rows = useMemo(() => chunkBooks(books, rowSize), [books, rowSize]);
  const bookIds = useMemo(() => books.map((book) => book.id), [books]);
  const selectedBookIdSet = useMemo(() => new Set(selectedBookIds), [selectedBookIds]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (!reorderMode || reorderPending || !onReorder) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = books.findIndex((book) => book.id === active.id);
    const newIndex = books.findIndex((book) => book.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    void onReorder(arrayMove(books, oldIndex, newIndex));
  };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={bookIds} strategy={rectSortingStrategy}>
          <section
            ref={shelfRef}
            className={cn("library-bookshelf space-y-6", reorderMode && "library-bookshelf-reordering")}
            aria-label="Interactive bookshelf"
            aria-busy={reorderPending || undefined}
          >
            <span className="library-shelf-measure" data-shelf-measure aria-hidden="true" />
            {rows.map((row, rowIndex) => (
              <div key={`shelf-${rowIndex}`} className="library-shelf-row">
                <span className="library-shelf-wall-shadow" aria-hidden="true" />
                <div className="library-shelf-books" style={{ gridTemplateColumns: `repeat(${rowSize}, minmax(0, 1fr))` }}>
                  {row.map((book, bookIndex) => (
                    <SortableShelfBook
                      key={book.id}
                      book={book}
                      bookIndex={bookIndex}
                      rowIndex={rowIndex}
                      highlighted={book.id === highlightedBookId}
                      reorderMode={reorderMode}
                      reorderPending={reorderPending}
                      position={rowIndex * rowSize + bookIndex} total={books.length}
                      onMove={(id, direction) => {
                        if (!onReorder || reorderPending) return;
                        const index = books.findIndex(item => item.id === id);
                        const owner = moveOwner.current;
                        setMoveFocus(`${id}:${direction}`);
                        // A failed save can regroup rows again. Restore the same
                        // visible alternative after either committed order or rollback.
                        void Promise.resolve(onReorder(arrayMove(books, index, index + direction))).finally(() => {
                          if (owner && moveOwner.current === owner) setMoveFocus(`${id}:${direction}`);
                        });
                      }}
                      selectMode={selectMode}
                      selected={selectedBookIdSet.has(book.id)}
                      onSelect={(book, trigger) => {
                        selectedBookTrigger.current = trigger;
                        selectedTriggerId.current = book.id;
                        selectionOpen.current = true;
                        setSelectedBook(book);
                      }}
                      onToggleSelect={onToggleSelect}
                    />
                  ))}
                  {!reorderMode && !selectMode && row.length < rowSize && (
                    <button
                      key={`add-book-slot-${rowIndex}`}
                      type="button"
                      className="library-shelf-add-book group"
                      onClick={() => navigate("/add-book")}
                      aria-label="Add a book to this shelf"
                    >
                      <span className="library-shelf-add-book-shadow" aria-hidden="true" />
                      <span className="library-shelf-add-book-cover" aria-hidden="true">
                        <AppIcon icon={APP_ICONS.common.add} variant="action" size="lg" />
                      </span>
                      <span className="mt-2 line-clamp-2 font-serif text-xs font-semibold text-muted-foreground transition-colors group-hover:text-primary">
                        Add book
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>
        </SortableContext>
      </DndContext>

      <LibraryBookshelfSelection
        book={selectedBook}
        userId={userId}
        open={Boolean(selectedBook)}
        onOpenChange={(open) => {
          selectionOpen.current = open;
          if (!open) setSelectedBook(null);
        }}
        onCloseAutoFocus={(event) => {
          // This is a programmatically opened preview, so Radix has no
          // DialogTrigger to restore. Row regrouping can replace its button
          // while the task stays open; resolve that book's current control.
          event.preventDefault();
          if (!selectionOpen.current) {
            const trigger = selectedBookTrigger.current?.isConnected ? selectedBookTrigger.current
              : [...(shelfRef.current?.querySelectorAll<HTMLButtonElement>("[data-library-book-id]") ?? [])]
                .find(button => button.dataset.libraryBookId === selectedTriggerId.current);
            const destination = trigger ?? focusFallbackRef?.current;
            if (destination?.isConnected) destination.focus({ preventScroll: true });
            selectedBookTrigger.current = null;
            selectedTriggerId.current = null;
          }
        }}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </>
  );
};
