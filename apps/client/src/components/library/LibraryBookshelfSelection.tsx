import { Dialog } from "@/components/ui/dialog";
import { AdaptiveDialogContent, AdaptiveDialogHeader, AdaptiveDialogTitle, AdaptiveDialogDescription } from "@/components/ui/adaptive-dialog";
import { LibraryBookPreview } from "./LibraryBookPreview";
import type { Book } from "@/types";

interface LibraryBookshelfSelectionProps {
  book: Book | null;
  userId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
  onView: (bookId: string) => void;
  onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void;
}

export const LibraryBookshelfSelection = ({
  book,
  userId,
  open,
  onOpenChange,
  onCloseAutoFocus,
  onView,
  onEdit,
  onDelete,
}: LibraryBookshelfSelectionProps) => {
  if (!book) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AdaptiveDialogContent size="wide" className="library-preview-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <AdaptiveDialogHeader className="sr-only">
          <AdaptiveDialogTitle>{book.title}</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>{book.author ? `by ${book.author}` : "Selected library book"}</AdaptiveDialogDescription>
        </AdaptiveDialogHeader>
        <LibraryBookPreview book={book} userId={userId} onView={onView} onEdit={onEdit} onDelete={onDelete}
          close={() => onOpenChange(false)} />
      </AdaptiveDialogContent>
    </Dialog>
  );
};
