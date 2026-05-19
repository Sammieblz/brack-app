import { type CSSProperties, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "iconoir-react";
import { gsap } from "gsap";
import { OptimizedImage } from "@/components/OptimizedImage";
import { LibraryBookshelfSelection } from "@/components/library/LibraryBookshelfSelection";
import { LibraryStatusBadge } from "@/components/library/LibraryBookActions";
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

export const LibraryBookshelfView = ({
  books,
  userId,
  highlightedBookId,
  onView,
  onEdit,
  onDelete,
}: LibraryBookshelfViewProps) => {
  const navigate = useNavigate();
  const { isPhone, isTablet, isDesktop } = useBreakpoint();
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const rowSize = isPhone ? 3 : isTablet ? 5 : isDesktop ? 7 : 9;
  const rows = useMemo(() => chunkBooks(books, rowSize), [books, rowSize]);

  return (
    <>
      <section className="library-bookshelf space-y-6" aria-label="Interactive bookshelf">
        {rows.map((row, rowIndex) => (
          <div key={`shelf-${rowIndex}`} className="library-shelf-row">
            <span className="library-shelf-wall-shadow" aria-hidden="true" />
            <div className="library-shelf-books" style={{ gridTemplateColumns: `repeat(${rowSize}, minmax(0, 1fr))` }}>
              {row.map((book, bookIndex) => {
                const progress = getProgressPercentage(book);
                const highlighted = book.id === highlightedBookId;
                const lean = ((rowIndex + bookIndex) % 5) - 2;
                const depth = 8 + ((rowIndex + bookIndex) % 4) * 2;
                const bookStyle = {
                  "--book-lean": `${lean * 0.85}deg`,
                  "--book-depth": `${depth}px`,
                } as CSSProperties;

                return (
                  <button
                    key={book.id}
                    type="button"
                    className={cn("library-shelf-book group", highlighted && "library-shelf-book-highlighted")}
                    style={bookStyle}
                    onClick={() => setSelectedBook(book)}
                    onMouseEnter={(event) => animateBook(event.currentTarget, true)}
                    onMouseLeave={(event) => animateBook(event.currentTarget, false)}
                    onFocus={(event) => animateBook(event.currentTarget, true)}
                    onBlur={(event) => animateBook(event.currentTarget, false)}
                    aria-label={`Open ${book.title}`}
                  >
                    <span className="library-shelf-book-shadow" aria-hidden="true" />
                    <span className="library-shelf-cover">
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
                  </button>
                );
              })}
              {row.length < rowSize && (
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
