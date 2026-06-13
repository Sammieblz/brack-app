import { OptimizedImage } from "@/components/OptimizedImage";
import {
  LibraryBookActions,
  LibraryBookDateLine,
  LibraryStatusBadge,
} from "@/components/library/LibraryBookActions";
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
import { getProgressPercentage } from "@/utils/bookProgress";
import type { Book } from "@/types";

interface LibraryBookDetailSheetProps {
  book: Book | null;
  userId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onView: (bookId: string) => void;
  onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void;
}

export const LibraryBookDetailSheet = ({
  book,
  userId,
  open,
  onOpenChange,
  onView,
  onEdit,
  onDelete,
}: LibraryBookDetailSheetProps) => {
  const { isPhone } = useBreakpoint();

  if (!book) return null;

  const progress = getProgressPercentage(book);
  const hasProgress = book.status === "reading" && Boolean(book.pages);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isPhone ? "bottom" : "right"}
        className="max-h-[88vh] overflow-y-auto rounded-t-2xl p-5 sm:max-w-md sm:rounded-none"
      >
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="line-clamp-2">{book.title}</SheetTitle>
          <SheetDescription>
            {book.author ? `by ${book.author}` : "Library book"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4">
            {book.cover_url ? (
              <OptimizedImage
                src={book.cover_url}
                alt={book.title}
                className="h-36 w-24 rounded-md object-cover shadow-md"
              />
            ) : (
              <div className="flex h-36 w-24 items-center justify-center rounded-md bg-primary/10 text-primary">
                <APP_ICONS.dashboard.coverFallback className="h-8 w-8" />
              </div>
            )}

            <div className="min-w-0 space-y-3">
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

              {hasProgress && (
                <div className="space-y-1.5">
                  <Progress value={progress} className="h-1.5" />
                  <p className="font-sans text-xs text-muted-foreground">
                    {book.current_page || 0} / {book.pages} pages ({Math.round(progress)}%)
                  </p>
                </div>
              )}

              <LibraryBookActions
                book={book}
                userId={userId}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          </div>

          {(book.description || book.notes) && (
            <div className="space-y-3 rounded-lg border border-border/60 bg-card/50 p-4">
              {book.description && (
                <p className="font-serif text-sm leading-6 text-muted-foreground">
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

          <div className="grid gap-2 rounded-lg border border-border/60 bg-background/45 p-4 font-sans text-xs text-muted-foreground">
            <LibraryBookDateLine label="Started" date={book.date_started} />
            <LibraryBookDateLine label="Finished" date={book.date_finished} />
            {book.isbn && <span>ISBN {book.isbn}</span>}
            {book.tags && book.tags.length > 0 && <span>{book.tags.join(", ")}</span>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

