import { type CSSProperties, type MouseEvent, useMemo, useRef, useState } from "react";
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
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { getShelfRowSize } from "./libraryLayout";
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
  reorderMode?: boolean;
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
  } = useSortable({ id: book.id, disabled: !reorderMode });
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
        {...(reorderMode ? attributes : {})}
        {...(reorderMode ? listeners : {})}
        onClick={handleActivate}
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
      <span className="library-shelf-title mt-2 line-clamp-2 font-serif text-xs font-semibold text-foreground" aria-hidden="true">
        {book.title}
      </span>
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
  reorderMode = false,
  onReorder,
  selectMode = false,
  selectedBookIds = [],
  onToggleSelect,
}: LibraryBookshelfViewProps) => {
  const navigate = useNavigate();
  const { width } = useBreakpoint();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const selectedBookTrigger = useRef<HTMLButtonElement | null>(null);
  const selectionOpen = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const rowSize = getShelfRowSize(width);
  const rows = useMemo(() => chunkBooks(books, rowSize), [books, rowSize]);
  const bookIds = useMemo(() => books.map((book) => book.id), [books]);
  const selectedBookIdSet = useMemo(() => new Set(selectedBookIds), [selectedBookIds]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (!reorderMode || !onReorder) return;

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
            className={cn("library-bookshelf space-y-6", reorderMode && "library-bookshelf-reordering")}
            aria-label="Interactive bookshelf"
          >
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
                      selectMode={selectMode}
                      selected={selectedBookIdSet.has(book.id)}
                      onSelect={(book, trigger) => {
                        selectedBookTrigger.current = trigger;
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
          // DialogTrigger to restore. Do not steal focus during a responsive
          // dialog/sheet switch or after navigating away from the shelf.
          event.preventDefault();
          if (!selectionOpen.current && selectedBookTrigger.current?.isConnected) {
            selectedBookTrigger.current.focus({ preventScroll: true });
            selectedBookTrigger.current = null;
          }
        }}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </>
  );
};
