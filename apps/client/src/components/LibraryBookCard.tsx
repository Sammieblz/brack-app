import { Progress } from "@/components/ui/progress";
import { LibraryBookActions } from "@/components/library/LibraryBookActions";
import { LibraryPhysicalBookCover } from "@/components/library/LibraryPhysicalBookCover";
import { LibraryBookPrimaryAction } from "@/components/library/LibraryBookPrimaryAction";
import { activateLibraryBookSurface } from "@/components/library/activateLibraryBookSurface";
import { formatBookStatus } from "@/components/library/libraryBookUtils";
import { AppIcon } from "@/components/ui/app-icon";
import { APP_ICONS } from "@/config/iconography";
import { cn } from "@/lib/utils";
import { getProgressPercentage } from "@/utils/bookProgress";
import type { Book } from "@/types";
import "@/components/library/library-reading-room.css";

interface LibraryBookCardProps {
  book: Book; userId?: string; highlighted?: boolean; selectMode?: boolean; selected?: boolean;
  onView: (bookId: string) => void; onEdit: (bookId: string) => void;
  onDelete: (bookId: string) => Promise<void> | void; onToggleSelect?: (bookId: string) => void;
}

export const LibraryBookCard = ({ book, userId, highlighted = false, selectMode = false, selected = false,
  onView, onEdit, onDelete, onToggleSelect }: LibraryBookCardProps) => {
  const progress = getProgressPercentage(book);
  const hasProgress = book.status === "reading" && Boolean(book.pages);
  const activate = () => selectMode ? onToggleSelect?.(book.id) : onView(book.id);
  return <article id={`book-${book.id}`} aria-label={book.title} data-selected={selected}
    className={cn("library-book-surface library-reading-row", highlighted && "ring-2 ring-primary/70")}
    onClick={event => activateLibraryBookSurface(event, activate)}>
    <LibraryBookPrimaryAction title={book.title} selectMode={selectMode} selected={selected} onActivate={activate} />
    <div className="library-reading-row__body">
      <div><LibraryPhysicalBookCover book={book} variant="card" /></div>
      <div className="min-w-0">
        <div className="flex items-start gap-2"><h3 className="library-reading-row__title min-w-0 flex-1">{book.title}</h3>
          {selectMode && <span aria-hidden="true" className={cn("mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-primary", selected && "bg-primary text-primary-foreground")}>
            {selected && <AppIcon icon={APP_ICONS.common.check} className="size-4" />}
          </span>}
        </div>
        {book.author && <p className="library-reading-row__author">{book.author}</p>}
        <p className="mt-2 font-sans text-xs text-muted-foreground"><span className="capitalize">{formatBookStatus(book.status)}</span>{book.genre && <> · <span>{book.genre}</span></>}</p>
        {hasProgress && <div className="library-reading-row__progress space-y-1.5">
          <Progress value={progress} className="h-1" aria-label={`Reading progress for ${book.title}`} />
          <p className="font-sans text-xs text-muted-foreground">{book.current_page || 0} / {book.pages} pages · {Math.round(progress)}%</p>
        </div>}
      </div>
    </div>
    {!selectMode && <div className="library-reading-row__actions">
      <LibraryBookActions book={book} userId={userId} onView={onView} onEdit={onEdit} onDelete={onDelete} />
    </div>}
  </article>;
};
