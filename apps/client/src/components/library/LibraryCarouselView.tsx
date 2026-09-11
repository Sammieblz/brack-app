import { useEffect, useMemo, useRef, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getProgressPercentage } from "@/utils/bookProgress";
import type { Book } from "@/types";

interface LibraryCarouselViewProps {
  books: Book[];
  userId?: string;
  highlightedBookId?: string;
  onView: (bookId: string) => void;
  onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void;
  selectMode?: boolean;
  selectedBookIds?: string[];
  onToggleSelect?: (bookId: string) => void;
}

export const LibraryCarouselView = ({
  books,
  userId,
  highlightedBookId,
  onView,
  onEdit,
  onDelete,
  selectMode = false,
  selectedBookIds = [],
  onToggleSelect,
}: LibraryCarouselViewProps) => {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const selectedBookIdSet = useMemo(() => new Set(selectedBookIds), [selectedBookIds]);

  useEffect(() => {
    if (!api) return;

    const updateSelected = () => setSelectedIndex(api.selectedScrollSnap());
    updateSelected();
    api.on("select", updateSelected);
    api.on("reInit", updateSelected);

    return () => {
      api.off("select", updateSelected);
      api.off("reInit", updateSelected);
    };
  }, [api]);

  return (
    <>
      <section className="library-carousel rounded-xl border border-border/60 bg-card/55 p-3 sm:p-4">
        <Carousel
          setApi={setApi}
          opts={{ align: "start", containScroll: "trimSnaps" }}
          className="min-w-0"
          aria-label="Library carousel"
        >
          <CarouselContent className="-ml-3 py-1">
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
                      "library-book-surface library-carousel-card relative flex h-full min-h-[24rem] flex-col rounded-xl border border-border/70 bg-background/80 p-4 shadow-sm transition-[border-color,box-shadow] duration-150",
                      isSelected && "border-primary/55 shadow-medium",
                      highlighted && "ring-2 ring-primary/70 shadow-glow",
                      selectMode && "cursor-pointer",
                      selectedForBulk && "border-primary/70 ring-2 ring-primary/65"
                    )}
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

                      <h3 className="mt-3 line-clamp-2 font-serif text-lg font-semibold leading-snug text-foreground">
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="mt-1 line-clamp-1 font-serif text-sm text-muted-foreground">
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
                          <Progress value={progress} className="h-1.5" />
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

          <div className="mt-4 flex items-center justify-between gap-3">
            <CarouselPrevious className="static h-11 w-11 translate-y-0 hover:translate-y-0" />
            <div className="min-w-0 flex-1 text-center">
              <div className="max-w-full overflow-x-auto">
                <div className="flex w-max min-w-full justify-center px-1">
                  {books.map((book, index) => (
                    <button
                      key={book.id}
                      type="button"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                      aria-label={`Go to ${book.title}`}
                      aria-current={selectedIndex === index ? "true" : undefined}
                      onClick={() => api?.scrollTo(index)}
                    >
                      <span aria-hidden="true" className={cn("h-1.5 rounded-full", selectedIndex === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/35")} />
                    </button>
                  ))}
                </div>
              </div>
              <p className="font-sans text-xs text-muted-foreground">
                {selectedIndex + 1} of {books.length}
              </p>
            </div>
            <CarouselNext className="static h-11 w-11 translate-y-0 hover:translate-y-0" />
          </div>
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
          if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
        }}
      />
    </>
  );
};
