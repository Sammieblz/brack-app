import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { LIBRARY_CAROUSEL_ITEM } from "./libraryLayout";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { LibraryBookDetailSheet } from "@/components/library/LibraryBookDetailSheet";
import {
  LibraryBookActions,
  LibraryStatusBadge,
} from "@/components/library/LibraryBookActions";
import { LibraryPhysicalBookCover } from "@/components/library/LibraryPhysicalBookCover";
import { LibraryBookPrimaryAction } from "./LibraryBookPrimaryAction";
import { activateLibraryBookSurface } from "./activateLibraryBookSurface";
import { AppIcon } from "@/components/ui/app-icon";
import { APP_ICONS } from "@/config/iconography";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getProgressPercentage } from "@/utils/bookProgress";
import type { Book } from "@/types";

// Bounded, in-memory book IDs only. Entries cannot leak into another account/history entry.
const returnBooks = new Map<string, string>();

interface LibraryCarouselViewProps {
  contextKey?: string;
  books: Book[];
  userId?: string;
  highlightedBookId?: string;
  onView: (bookId: string) => void;
  onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void;
  focusFallbackRef?: RefObject<HTMLElement | null>;
  selectMode?: boolean;
  selectedBookIds?: string[];
  onToggleSelect?: (bookId: string) => void;
}

export const LibraryCarouselView = ({
  books,
  contextKey,
  userId,
  highlightedBookId,
  onView,
  onEdit,
  onDelete,
  focusFallbackRef,
  selectMode = false,
  selectedBookIds = [],
  onToggleSelect,
}: LibraryCarouselViewProps) => {
  const reducedMotion = useReducedMotion();
  const [startIndex] = useState(() => Math.max(0, books.findIndex(book => book.id === (contextKey ? returnBooks.get(contextKey) : undefined))));
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(startIndex);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const selectedBookIdSet = useMemo(() => new Set(selectedBookIds), [selectedBookIds]);

  useEffect(() => {
    if (!api) return;

    const updateSelected = () => {
      const index = api.selectedScrollSnap();
      setSelectedIndex(index);
      if (contextKey && books[index]) {
        returnBooks.delete(contextKey);
        returnBooks.set(contextKey, books[index].id);
        if (returnBooks.size > 40) returnBooks.delete(returnBooks.keys().next().value!);
      }
    };
    updateSelected();
    api.on("select", updateSelected);
    api.on("reInit", updateSelected);

    return () => {
      api.off("select", updateSelected);
      api.off("reInit", updateSelected);
    };
  }, [api, books, contextKey]);

  return (
    <>
      <section className="library-carousel">
        <Carousel
          setApi={setApi}
          opts={{ align: "start", containScroll: false, startIndex, duration: 25,
            breakpoints: { "(prefers-reduced-motion: reduce)": { duration: 0 } } }}
          className="min-w-0"
          aria-label="Library carousel"
          onKeyDownCapture={event => {
            if (event.defaultPrevented || !(event.target instanceof HTMLElement) || !event.currentTarget.contains(event.target)
              || event.target.closest('input, textarea, select, [contenteditable="true"], [role="slider"], [role="combobox"], [role="listbox"], [role="menu"], [role="tablist"]')) return;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              if (event.key === "ArrowLeft") api?.scrollPrev(true); else api?.scrollNext(true);
            }
          }}
        >
          <div className="library-carousel-navigation">
            <CarouselPrevious className="static h-11 w-11 translate-y-0 hover:translate-y-0" onClick={event => api?.scrollPrev(reducedMotion || event.detail === 0)} />
            <div className="library-carousel-position min-w-0">
              <label className="sr-only" htmlFor="library-carousel-chooser">Choose a book</label>
              <select id="library-carousel-chooser" className="library-carousel-chooser" value={books[selectedIndex]?.id ?? books[0]?.id}
                onChange={event => api?.scrollTo(books.findIndex(book => book.id === event.target.value), true)}>
                {books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
              </select>
              <p className="mt-1 text-center font-sans text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">{Math.min(selectedIndex + 1, books.length)} of {books.length}</p>
            </div>
            <CarouselNext className="static h-11 w-11 translate-y-0 hover:translate-y-0" onClick={event => api?.scrollNext(reducedMotion || event.detail === 0)} />
          </div>
          <CarouselContent className="-ml-4 py-1">
            {books.map((book, index) => {
              const progress = getProgressPercentage(book);
              const isSelected = index === selectedIndex;
              const highlighted = book.id === highlightedBookId;
              const selectedForBulk = selectedBookIdSet.has(book.id);
              const activate = () => {
                if (selectMode) {
                  onToggleSelect?.(book.id);
                  return;
                }
                returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                setSelectedBook(book);
              };

              return (
                <CarouselItem
                  key={book.id}
                  className={LIBRARY_CAROUSEL_ITEM}
                >
                  <article
                    className={cn(
                      "library-book-surface library-carousel-card",
                      highlighted && "ring-2 ring-primary/70 shadow-glow",
                      selectMode && "cursor-pointer",
                      selectedForBulk && "border-primary/70 ring-2 ring-primary/65"
                    )}
                    aria-current={isSelected ? "true" : undefined}
                    data-selected={selectedForBulk}
                    data-library-book-id={book.id}
                    onClick={(event) => activateLibraryBookSurface(event, activate)}
                  >
                    <LibraryBookPrimaryAction title={book.title} selectMode={selectMode} selected={selectedForBulk} opensDialog onActivate={activate} />
                    {selectMode && (
                      <span
                        className={cn(
                          "pointer-events-none absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background/95 backdrop-blur",
                          selectedForBulk && "bg-primary/10"
                        )}
                        aria-hidden="true"
                      >
                        <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border border-primary", selectedForBulk && "bg-primary text-primary-foreground")}>
                          {selectedForBulk && <AppIcon icon={APP_ICONS.common.check} className="h-3.5 w-3.5" />}
                        </span>
                      </span>
                    )}
                    <div className="relative z-[1] flex flex-1 flex-col text-left">
                      <LibraryPhysicalBookCover
                        book={book}
                        variant="carousel"
                        className="mx-auto"
                      />

                      <span className="mt-4 flex flex-wrap items-center gap-2">
                        <LibraryStatusBadge status={book.status} />
                        {book.pages && (
                          <span className="font-sans text-xs text-muted-foreground">
                            {book.pages} pages
                          </span>
                        )}
                      </span>

                      <h3 className="mt-3 font-serif text-lg font-semibold leading-snug text-foreground">
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="mt-1 font-serif text-sm text-muted-foreground">
                          by {book.author}
                        </p>
                      )}
                      {book.genre && (
                        <p className="mt-2 font-sans text-xs text-muted-foreground">
                          {book.genre}
                        </p>
                      )}

                      {book.status === "reading" && Boolean(book.pages) && (
                        <div className="mt-3 space-y-1.5">
                          <Progress value={progress} aria-label={`Reading progress for ${book.title}`} className="h-1.5" />
                          <p className="font-sans text-xs text-muted-foreground">
                            {book.current_page || 0} / {book.pages} pages ({Math.round(progress)}%)
                          </p>
                        </div>
                      )}
                    </div>

                    {!selectMode && (
                      <div className="relative z-[1] mt-4 border-t border-border/60 pt-3">
                        <LibraryBookActions
                          book={book}
                          userId={userId}
                          onView={onView}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          className="justify-center"
                        />
                      </div>
                    )}
                  </article>
                </CarouselItem>
              );
            })}
          </CarouselContent>

        </Carousel>
      </section>

      <LibraryBookDetailSheet
        book={selectedBook}
        userId={userId}
        open={Boolean(selectedBook)}
        onOpenChange={(open) => {
          if (!open) setSelectedBook(null);
        }}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onCloseAutoFocus={() => {
          const destination = returnFocus.current?.isConnected ? returnFocus.current : focusFallbackRef?.current;
          if (destination?.isConnected) destination.focus({ preventScroll: true });
        }}
      />
    </>
  );
};
