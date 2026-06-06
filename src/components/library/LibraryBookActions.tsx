import { type ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  EditPencil,
  JournalPage,
  NavArrowRight,
  Trash,
} from "iconoir-react";
import { AddToListDialog } from "@/components/AddToListDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { APP_ICONS } from "@/config/iconography";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";
import { formatBookDate, formatBookStatus, statusStyles } from "./libraryBookUtils";

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

interface LibraryBookActionsProps {
  book: Book;
  userId?: string;
  onView: (bookId: string) => void;
  onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void;
  className?: string;
}

export const LibraryBookActions = ({
  book,
  userId,
  onView,
  onEdit,
  onDelete,
  className,
}: LibraryBookActionsProps) => {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = async () => {
    setDeleteOpen(false);
    await onDelete(book.id);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
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
};

export const LibraryStatusBadge = ({ status }: { status: string }) => (
  <Badge
    className={cn(
      "px-2 py-0.5 text-[11px] capitalize",
      statusStyles[status] || "bg-muted text-muted-foreground"
    )}
  >
    {formatBookStatus(status)}
  </Badge>
);

export const LibraryBookDateLine = ({
  label,
  date,
}: {
  label: string;
  date?: string | null;
}) => {
  const formatted = formatBookDate(date);
  if (!formatted) return null;
  return (
    <span className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-primary" />
      {label} {formatted}
    </span>
  );
};
