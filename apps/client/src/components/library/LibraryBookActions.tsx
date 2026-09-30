import { type ReactNode, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AddToListDialog } from "@/components/AddToListDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LibraryRemoveDialog } from "./LibraryRemoveDialog";
import { APP_ICONS } from "@/config/iconography";
import { AppIcon } from "@/components/ui/app-icon";
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
        className={cn("h-11 w-11 rounded-full transition-[background-color,border-color,color,box-shadow] hover:translate-y-0", className)}
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

const LibraryBookActionsContent = ({
  book,
  userId,
  onView,
  onEdit,
  onDelete,
  className,
}: LibraryBookActionsProps) => {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const deleteTrigger = useRef<HTMLButtonElement>(null);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <IconAction label="View details" onClick={() => onView(book.id)}>
        <AppIcon icon={APP_ICONS.common.forward} variant="action" />
      </IconAction>
      <IconAction
        label="Log progress"
        onClick={() => navigate(`/book/${book.id}/progress`)}
      >
        <AppIcon icon={APP_ICONS.bookDetail.logProgress} variant="action" />
      </IconAction>
      <IconAction label="Edit book" onClick={() => onEdit(book.id)}>
        <AppIcon icon={APP_ICONS.common.edit} variant="action" />
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
              className="h-11 w-11 rounded-full transition-[background-color,border-color,color,box-shadow] hover:translate-y-0"
            >
              <AppIcon icon={APP_ICONS.library.bookLists} variant="action" />
            </Button>
          }
        />
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button ref={deleteTrigger} type="button" variant="outline" size="icon"
            aria-label="Delete book" title="Delete book" aria-haspopup="dialog" aria-expanded={deleteOpen}
            onClick={() => setDeleteOpen(true)}
            className="h-11 w-11 rounded-full border-destructive/50 text-destructive hover:bg-destructive/10">
            <AppIcon icon={APP_ICONS.common.delete} variant="action" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete book</TooltipContent>
      </Tooltip>
      <LibraryRemoveDialog open={deleteOpen} onOpenChange={setDeleteOpen} returnFocusRef={deleteTrigger}
        title="Delete this book?" description={`This removes "${book.title}" from your library. You can re-add it later.`}
        onConfirm={() => onDelete(book.id)} />
    </div>
  );
};

export const LibraryBookActions = (props: LibraryBookActionsProps) =>
  <LibraryBookActionsContent key={`${props.userId ?? ""}:${props.book.id}`} {...props} />;

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
      <AppIcon icon={APP_ICONS.bookDetail.progressDate} variant="inline" className="text-primary" />
      {label} {formatted}
    </span>
  );
};
