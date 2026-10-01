import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AddToListDialog } from "@/components/AddToListDialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LibraryRemoveDialog } from "./LibraryRemoveDialog";
import { APP_ICONS } from "@/config/iconography";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";
import { formatBookDate, formatBookStatus, statusStyles } from "./libraryBookUtils";
import "./library-reading-room.css";

interface LibraryBookActionsProps {
  book: Book; userId?: string;
  onView: (bookId: string) => void; onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void; className?: string;
}

const LibraryBookActionsContent = ({ book, userId, onView, onEdit, onDelete, className }: LibraryBookActionsProps) => {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  return <Collapsible className={cn("library-book-action-disclosure", className)} data-library-book-control>
    <div className="flex flex-wrap items-center justify-between gap-1">
      <Link to={`/book/${book.id}/progress`} className="library-text-control">
        <AppIcon icon={APP_ICONS.bookDetail.logProgress} variant="action" />Log progress
      </Link>
      <CollapsibleTrigger asChild>
        <button type="button" className="library-text-control" aria-label={`More actions for ${book.title}`}>
          More<APP_ICONS.common.forward className="size-4 rotate-90" aria-hidden="true" />
        </button>
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent>
      <div className="library-book-action-menu" role="group" aria-label={`Actions for ${book.title}`}>
        <button type="button" className="library-text-control" onClick={() => onView(book.id)}>View details</button>
        <button type="button" className="library-text-control" onClick={() => onEdit(book.id)}>Edit book</button>
        {userId && <AddToListDialog bookId={book.id} userId={userId}
          trigger={<button type="button" className="library-text-control"><AppIcon icon={APP_ICONS.library.bookLists} variant="action" />Add to list</button>} />}
        <button ref={deleteTrigger} type="button" className="library-text-control library-destructive-control" aria-haspopup="dialog"
          aria-expanded={deleteOpen} onClick={() => setDeleteOpen(true)}>Delete book</button>
      </div>
    </CollapsibleContent>
    <LibraryRemoveDialog open={deleteOpen} onOpenChange={setDeleteOpen} returnFocusRef={deleteTrigger}
      title="Delete this book?" description={`This removes "${book.title}" from your library. You can re-add it later.`}
      onConfirm={() => onDelete(book.id)} />
  </Collapsible>;
};

export const LibraryBookActions = (props: LibraryBookActionsProps) =>
  <LibraryBookActionsContent key={`${props.userId ?? ""}:${props.book.id}`} {...props} />;

export const LibraryStatusBadge = ({ status }: { status: string }) => (
  <Badge
    className={cn(
      "px-2 py-0.5 text-[0.6875rem] capitalize",
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
