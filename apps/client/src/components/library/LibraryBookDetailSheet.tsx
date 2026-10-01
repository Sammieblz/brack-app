import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { LibraryBookPreview } from "./LibraryBookPreview";
import type { Book } from "@/types";

interface LibraryBookDetailSheetProps {
  book: Book | null;
  userId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onView: (bookId: string) => void;
  onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void;
  onCloseAutoFocus?: () => void;
}

export const LibraryBookDetailSheet = ({
  book,
  userId,
  open,
  onOpenChange,
  onView,
  onEdit,
  onDelete,
  onCloseAutoFocus,
}: LibraryBookDetailSheetProps) => {
  const { isPhone } = useBreakpoint();

  if (!book) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isPhone ? "bottom" : "right"}
        className="library-preview-sheet max-h-[88vh] overflow-y-auto rounded-t-2xl p-5 sm:max-w-xl sm:rounded-none"
        onCloseAutoFocus={onCloseAutoFocus ? event => { event.preventDefault(); onCloseAutoFocus(); } : undefined}>
        <SheetHeader className="sr-only">
          <SheetTitle>{book.title}</SheetTitle>
          <SheetDescription>{book.author ? `by ${book.author}` : "Library book"}</SheetDescription>
        </SheetHeader>
        <LibraryBookPreview book={book} userId={userId} onView={onView} onEdit={onEdit} onDelete={onDelete} close={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
};
