import { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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

              return (
                <CarouselItem
                  key={book.id}
                  className="basis-[86%] pl-3 sm:basis-1/2 lg:basis-1/3 2xl:basis-1/4"
                >
                  <article
                    className={cn(
                      "library-carousel-card relative flex h-full min-h-[24rem] flex-col rounded-xl border border-border/70 bg-background/80 p-4 shadow-sm transition-all duration-300",
                      isSelected && "border-primary/55 shadow-medium",
                      highlighted && "ring-2 ring-primary/70 shadow-glow",
                      selectMode && "cursor-pointer",
                      selectedForBulk && "border-primary/70 ring-2 ring-primary/65"
                    )}
                  >
                    {selectMode && (
                      <span
                        className={cn(
                          "absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background/95 backdrop-blur transition-colors",
                          selectedForBulk && "bg-primary/10"
                        )}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedForBulk}
                          onCheckedChange={() => onToggleSelect?.(book.id)}
                          aria-label={`Select ${book.title}`}
                          className="h-5 w-5 rounded-full"
                        />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (selectMode) {
                          onToggleSelect?.(book.id);
                          return;
                        }
                        setSelectedBook(book);
                      }}
                      className="group flex flex-1 flex-col text-left"
                      aria-label={selectMode ? `Select ${book.title}` : `Open ${book.title}`}
                      aria-pressed={selectMode ? selectedForBulk : undefined}
                    >
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

                      <h3 className="mt-3 line-clamp-2 font-serif text-lg font-semibold leading-snug text-foreground group-hover:text-primary">
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
                    </button>

                    {!selectMode && (
                      <div className="mt-4 border-t border-border/60 pt-3">
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
            <CarouselPrevious className="static translate-y-0" />
            <div className="min-w-0 flex-1 text-center">
              <div className="mb-1 flex max-w-full justify-start gap-1.5 overflow-x-auto px-1 sm:justify-center">
                {books.map((book, index) => (
                  <button
                    key={book.id}
                    type="button"
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      selectedIndex === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/35"
                    )}
                    aria-label={`Go to ${book.title}`}
                    onClick={() => api?.scrollTo(index)}
                  />
                ))}
              </div>
              <p className="font-sans text-xs text-muted-foreground">
                {selectedIndex + 1} of {books.length}
              </p>
            </div>
            <CarouselNext className="static translate-y-0" />
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
      />
    </>
  );
};
