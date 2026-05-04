import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  EditPencil,
  JournalPage,
  NavArrowRight,
  Trash,
} from "iconoir-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AddToListDialog } from "@/components/AddToListDialog";
import { OptimizedImage } from "@/components/OptimizedImage";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { APP_ICONS } from "@/config/iconography";
import { cn } from "@/lib/utils";
import { getProgressPercentage } from "@/utils/bookProgress";
import type { Book } from "@/types";

interface LibraryBookCardProps {
  book: Book;
  userId?: string;
  highlighted?: boolean;
  onView: (bookId: string) => void;
  onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void;
}

const statusStyles: Record<string, string> = {
  completed: "bg-green-500 text-white",
  reading: "bg-orange-500 text-white",
  to_read: "bg-blue-500 text-white",
};

const formatStatus = (status: string) => status.replace("_", " ");

const formatDate = (date?: string | null) => {
  if (!date) return null;
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

interface IconActionProps {
  label: string;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}

const IconAction = ({ label, className, onClick, children }: IconActionProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={label}
        title={label}
        onClick={onClick}
        className={cn("h-10 w-10 rounded-full", className)}
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

export const LibraryBookCard = ({
  book,
  userId,
  highlighted = false,
  onView,
  onEdit,
  onDelete,
}: LibraryBookCardProps) => {
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const progress = getProgressPercentage(book);
  const hasProgress = book.status === "reading" && Boolean(book.pages);

  const handleDelete = async () => {
    setDeleteOpen(false);
    await onDelete(book.id);
  };

  const actionControls = (
    <div className="flex flex-wrap items-center gap-2">
      <IconAction label="View details" onClick={() => onView(book.id)}>
        <NavArrowRight className="h-4 w-4" />
      </IconAction>
      <IconAction
        label="Log progress"
        onClick={() => navigate(`/book/${book.id}/progress`)}
      >
        <JournalPage className="h-4 w-4" />
      </IconAction>
      <IconAction label="Edit book" onClick={() => onEdit(book.id)}>
        <EditPencil className="h-4 w-4" />
      </IconAction>
      {userId && (
        <AddToListDialog
          bookId={book.id}
          userId={userId}
          triggerTooltip="Add to list"
          trigger={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Add to list"
              title="Add to list"
              className="h-10 w-10 rounded-full"
            >
              <APP_ICONS.library.bookLists className="h-4 w-4" />
            </Button>
          }
        />
      )}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogTrigger asChild>
          <span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Delete book"
                  title="Delete book"
                  className="h-10 w-10 rounded-full border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete book</TooltipContent>
            </Tooltip>
          </span>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this book?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes "{book.title}" from your library. You can re-add it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep book</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  return (
    <Card
      id={`book-${book.id}`}
      className={cn(
        "overflow-hidden border-border/70 bg-card/85 shadow-sm transition-all duration-300",
        highlighted && "ring-2 ring-primary/70 shadow-glow"
      )}
    >
      <Accordion type="single" collapsible>
        <AccordionItem value={book.id} className="border-0">
          <CardContent className="p-0">
            <div className="flex min-h-[8.75rem] gap-3 p-3 sm:p-4">
              <button
                type="button"
                className="shrink-0"
                onClick={(event) => {
                  event.stopPropagation();
                  if (book.cover_url) setLightboxOpen(true);
                }}
                aria-label={`Open ${book.title} cover`}
              >
                {book.cover_url ? (
                  <ImageLightbox
                    src={book.cover_url}
                    alt={book.title}
                    isOpen={lightboxOpen}
                    onClose={() => setLightboxOpen(false)}
                  >
                    <OptimizedImage
                      src={book.cover_url}
                      alt={book.title}
                      className="h-24 w-16 rounded-md object-cover shadow-sm sm:h-28 sm:w-[4.5rem]"
                    />
                  </ImageLightbox>
                ) : (
                  <div className="flex h-24 w-16 items-center justify-center rounded-md bg-primary/10 text-primary sm:h-28 sm:w-[4.5rem]">
                    <APP_ICONS.dashboard.coverFallback className="h-7 w-7" />
                  </div>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onView(book.id)}
                    className="min-w-0 text-left"
                  >
                    <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug text-foreground transition-colors hover:text-primary">
                      {book.title}
                    </h3>
                    {book.author && (
                      <p className="mt-0.5 truncate font-serif text-sm text-muted-foreground">
                        by {book.author}
                      </p>
                    )}
                  </button>

                  <AccordionTrigger
                    className="h-9 w-9 shrink-0 justify-center rounded-full p-0 hover:bg-accent hover:no-underline"
                    aria-label={`Expand ${book.title}`}
                  >
                    <span className="sr-only">Expand</span>
                  </AccordionTrigger>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      "px-2 py-0.5 text-[11px] capitalize",
                      statusStyles[book.status] || "bg-muted text-muted-foreground"
                    )}
                  >
                    {formatStatus(book.status)}
                  </Badge>
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
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      Started {formatDate(book.date_started)}
                    </span>
                  )}
                  {book.date_finished && (
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      Finished {formatDate(book.date_finished)}
                    </span>
                  )}
                  {book.isbn && <span>ISBN {book.isbn}</span>}
                  {book.tags && book.tags.length > 0 && <span>{book.tags.join(", ")}</span>}
                </div>

              </div>
            </AccordionContent>

            <div className="border-t border-border/60 px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
              {actionControls}
            </div>
          </CardContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
};
