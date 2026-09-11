import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LibraryBookActions,
  LibraryBookDateLine,
  LibraryStatusBadge,
} from "@/components/library/LibraryBookActions";
import { LibraryPhysicalBookCover } from "@/components/library/LibraryPhysicalBookCover";
import { LibraryBookPrimaryAction } from "@/components/library/LibraryBookPrimaryAction";
import { activateLibraryBookSurface } from "@/components/library/activateLibraryBookSurface";
import { AppIcon } from "@/components/ui/app-icon";
import { APP_ICONS } from "@/config/iconography";
import { cn } from "@/lib/utils";
import { getProgressPercentage } from "@/utils/bookProgress";
import type { Book } from "@/types";

interface LibraryBookCardProps {
  book: Book;
  userId?: string;
  highlighted?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onView: (bookId: string) => void;
  onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void;
  onToggleSelect?: (bookId: string) => void;
}

export const LibraryBookCard = ({
  book,
  userId,
  highlighted = false,
  selectMode = false,
  selected = false,
  onView,
  onEdit,
  onDelete,
  onToggleSelect,
}: LibraryBookCardProps) => {
  const progress = getProgressPercentage(book);
  const hasProgress = book.status === "reading" && Boolean(book.pages);
  const activate = () => selectMode ? onToggleSelect?.(book.id) : onView(book.id);

  return (
    <Card
      id={`book-${book.id}`}
      className={cn(
        "library-book-surface relative overflow-hidden border-border/70 bg-card/85 shadow-sm transition-[border-color,box-shadow] duration-150",
        highlighted && "ring-2 ring-primary/70 shadow-glow",
        selectMode && "cursor-pointer",
        selected && "border-primary/70 ring-2 ring-primary/65"
      )}
      onClick={(event) => activateLibraryBookSurface(event, activate)}
    >
      <LibraryBookPrimaryAction title={book.title} selectMode={selectMode} selected={selected} onActivate={activate} />
      {selectMode && (
        <div
          className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-background/90 p-1"
          aria-hidden="true"
        >
          <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border border-primary", selected && "bg-primary text-primary-foreground")}>
            {selected && <AppIcon icon={APP_ICONS.common.check} className="h-3.5 w-3.5" />}
          </span>
        </div>
      )}
      <Accordion type="single" collapsible className="relative z-[1]">
        <AccordionItem value={book.id} className="border-0">
          <CardContent className="p-0">
            <div className="flex min-h-[8.75rem] gap-3 p-3 sm:p-4">
              <div className="flex shrink-0 items-center">
                <LibraryPhysicalBookCover book={book} variant="card" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className={cn("min-w-0 text-left", selectMode && "pr-7")}>
                    <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug text-foreground">
                      {book.title}
                    </h3>
                    {book.author && (
                      <p className="mt-0.5 truncate font-serif text-sm text-muted-foreground">
                        by {book.author}
                      </p>
                    )}
                  </div>

                  {!selectMode && (
                    <AccordionTrigger
                      className="h-11 w-11 shrink-0 justify-center rounded-full p-0 hover:bg-accent hover:no-underline"
                      aria-label={`Expand ${book.title}`}
                    >
                      <span className="sr-only">Expand</span>
                    </AccordionTrigger>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <LibraryStatusBadge status={book.status} />
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
                  <div className="mt-3 h-5" aria-hidden="true" />
                )}
              </div>
            </div>

            <AccordionContent className="px-3 pb-3 sm:px-4 sm:pb-4">
              <div className="space-y-4 border-t border-border/60 pt-4">
                {(book.description || book.notes) && (
                  <div className="space-y-2">
                    {book.description && (
                      <p className="line-clamp-4 font-serif text-sm text-muted-foreground">
                        {book.description}
                      </p>
                    )}
                    {book.notes && (
                      <p className="rounded-md bg-muted/50 p-3 font-sans text-sm text-muted-foreground">
                        {book.notes}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid gap-2 font-sans text-xs text-muted-foreground sm:grid-cols-2">
                  {book.date_started && (
                    <LibraryBookDateLine label="Started" date={book.date_started} />
                  )}
                  {book.date_finished && (
                    <LibraryBookDateLine label="Finished" date={book.date_finished} />
                  )}
                  {book.isbn && <span>ISBN {book.isbn}</span>}
                  {book.tags && book.tags.length > 0 && <span>{book.tags.join(", ")}</span>}
                </div>

              </div>
            </AccordionContent>

            {!selectMode && (
              <div className="border-t border-border/60 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
                <LibraryBookActions
                  book={book}
                  userId={userId}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </div>
            )}
          </CardContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
};
