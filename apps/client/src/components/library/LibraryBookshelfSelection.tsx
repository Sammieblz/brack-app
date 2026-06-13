import { OptimizedImage } from "@/components/OptimizedImage";
import {
  LibraryBookActions,
  LibraryBookDateLine,
  LibraryStatusBadge,
} from "@/components/library/LibraryBookActions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { APP_ICONS } from "@/config/iconography";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";
import { getProgressPercentage } from "@/utils/bookProgress";
import type { Book } from "@/types";

interface LibraryBookshelfSelectionProps {
  book: Book | null;
  userId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onView: (bookId: string) => void;
  onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void;
}

const BookCover = ({ book, className }: { book: Book; className?: string }) => (
  <div className={cn("library-selected-book-cover", className)}>
    <span className="library-selected-book-pages" aria-hidden="true" />
    <span className="library-selected-book-face">
      {book.cover_url ? (
        <OptimizedImage
          src={book.cover_url}
          alt={book.title}
          className="h-full w-full rounded-[0.35rem] object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-[0.35rem] bg-primary/10 text-primary">
          <APP_ICONS.dashboard.coverFallback className="h-12 w-12" />
        </span>
      )}
    </span>
  </div>
);

const SelectionContent = ({
  book,
  userId,
  onView,
  onEdit,
  onDelete,
  close,
  compact = false,
}: {
  book: Book;
  userId?: string;
  onView: (bookId: string) => void;
  onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void;
  close: () => void;
  compact?: boolean;
}) => {
  const progress = getProgressPercentage(book);
  const hasProgress = book.status === "reading" && Boolean(book.pages);

  const handleDelete = async (bookId: string) => {
    await onDelete(bookId);
    close();
  };

  return (
    <div className={cn("library-selected-book", compact && "library-selected-book-compact")}>
      <div className="library-selected-book-stage" aria-hidden="true">
        <span className="library-selected-book-shadow" />
        <BookCover book={book} />
      </div>

      <div className="library-selected-book-page">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
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

          <h2 className="line-clamp-3 font-serif text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            {book.title}
          </h2>
          {book.author && (
            <p className="font-serif text-base text-muted-foreground">by {book.author}</p>
          )}
        </div>

        {hasProgress && (
          <div className="space-y-2 rounded-xl border border-border/55 bg-background/55 p-3">
            <div className="flex items-center justify-between gap-3 font-sans text-xs text-muted-foreground">
              <span>
                Page {book.current_page || 0} of {book.pages}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {(book.description || book.notes) && (
          <div className="library-selected-book-excerpt">
            {book.description && (
              <p className="line-clamp-5 font-serif text-sm leading-6 text-muted-foreground">
                {book.description}
              </p>
            )}
            {book.notes && (
              <p className="mt-3 rounded-lg bg-muted/45 p-3 font-sans text-sm text-muted-foreground">
                {book.notes}
              </p>
            )}
          </div>
        )}

        <div className="grid gap-2 rounded-xl border border-border/55 bg-background/45 p-3 font-sans text-xs text-muted-foreground sm:grid-cols-2">
          <LibraryBookDateLine label="Started" date={book.date_started} />
          <LibraryBookDateLine label="Finished" date={book.date_finished} />
          {book.isbn && <span>ISBN {book.isbn}</span>}
          {book.tags && book.tags.length > 0 && <span>{book.tags.join(", ")}</span>}
        </div>

        <LibraryBookActions
          book={book}
          userId={userId}
          onView={onView}
          onEdit={onEdit}
          onDelete={handleDelete}
          className="pt-1"
        />
      </div>
    </div>
  );
};

export const LibraryBookshelfSelection = ({
  book,
  userId,
  open,
  onOpenChange,
  onView,
  onEdit,
  onDelete,
}: LibraryBookshelfSelectionProps) => {
  const { isPhone } = useBreakpoint();

  if (!book) return null;

  if (isPhone) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="library-selected-book-sheet max-h-[90vh] overflow-y-auto rounded-t-3xl p-4"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{book.title}</SheetTitle>
            <SheetDescription>
              {book.author ? `by ${book.author}` : "Selected library book"}
            </SheetDescription>
          </SheetHeader>
          <SelectionContent
            book={book}
            userId={userId}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            close={() => onOpenChange(false)}
            compact
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="library-selected-book-dialog max-h-[88vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{book.title}</DialogTitle>
          <DialogDescription>
            {book.author ? `by ${book.author}` : "Selected library book"}
          </DialogDescription>
        </DialogHeader>
        <SelectionContent
          book={book}
          userId={userId}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          close={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};
