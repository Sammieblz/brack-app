import { type CSSProperties, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Drag, Plus } from "iconoir-react";
import { gsap } from "gsap";
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
import { Checkbox } from "@/components/ui/checkbox";
import { APP_ICONS } from "@/config/iconography";
import { useBreakpoint } from "@/hooks/useBreakpoint";
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

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const animateBook = (element: HTMLElement, active: boolean) => {
  if (prefersReducedMotion()) return;
  gsap.to(element, {
    y: active ? -18 : 0,
    rotateZ: active ? -1.2 : 0,
    rotateY: active ? -8 : 0,
    rotateX: active ? 2 : 0,
    scale: active ? 1.055 : 1,
    duration: 0.28,
    ease: "power3.out",
  });
};

interface SortableShelfBookProps {
  book: Book;
  bookIndex: number;
  rowIndex: number;
  highlighted: boolean;
  reorderMode: boolean;
  selectMode: boolean;
  selected: boolean;
  onSelect: (book: Book) => void;
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

  const handleActivate = () => {
    if (selectMode) {
      onToggleSelect?.(book.id);
      return;
    }
    if (!reorderMode) onSelect(book);
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
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (reorderMode) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handleActivate();
      }}
      onMouseEnter={(event) => {
        if (!reorderMode && !selectMode) animateBook(event.currentTarget, true);
      }}
      onMouseLeave={(event) => {
        if (!reorderMode && !selectMode) animateBook(event.currentTarget, false);
      }}
      onFocus={(event) => {
        if (!reorderMode && !selectMode) animateBook(event.currentTarget, true);
      }}
      onBlur={(event) => {
        if (!reorderMode && !selectMode) animateBook(event.currentTarget, false);
      }}
      aria-label={selectMode ? `Select ${book.title}` : reorderMode ? `Move ${book.title}` : `Open ${book.title}`}
      aria-pressed={selectMode ? selected : undefined}
      {...(reorderMode ? attributes : { role: "button", tabIndex: 0 })}
      {...(reorderMode ? listeners : {})}
    >
      <span className="library-shelf-book-shadow" aria-hidden="true" />
      {reorderMode && (
        <span className="library-shelf-drag-handle" aria-hidden="true">
          <Drag className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="library-shelf-cover">
        {selectMode && (
          <span
            className="library-shelf-select-checkbox"
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect?.(book.id)}
              aria-label={`Select ${book.title}`}
              className="h-5 w-5 rounded-full"
            />
          </span>
        )}
        <span className="library-shelf-cover-pages" aria-hidden="true" />
        <span className="library-shelf-cover-face">
          {book.cover_url ? (
            <OptimizedImage
              src={book.cover_url}
              alt={book.title}
              className="h-full w-full rounded-[0.22rem] object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center rounded-[0.22rem] bg-primary/10 text-primary">
              <APP_ICONS.dashboard.coverFallback className="h-7 w-7" />
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
      <span className="mt-2 line-clamp-2 font-serif text-xs font-semibold text-foreground transition-colors group-hover:text-primary">
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
  const { isPhone, isTablet, isDesktop } = useBreakpoint();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const rowSize = isPhone ? 3 : isTablet ? 5 : isDesktop ? 7 : 9;
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
                      onSelect={setSelectedBook}
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
                        <Plus className="h-7 w-7" />
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
          if (!open) setSelectedBook(null);
        }}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </>
  );
};
