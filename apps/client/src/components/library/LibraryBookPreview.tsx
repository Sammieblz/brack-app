import type { Book } from "@/types";
import { LibraryPhysicalBookCover } from "./LibraryPhysicalBookCover";
import { LibraryBookActions, LibraryBookDateLine, LibraryStatusBadge } from "./LibraryBookActions";
import { Progress } from "@/components/ui/progress";
import { getProgressPercentage } from "@/utils/bookProgress";

/** Book content shared by the two stable preview owners; no overlay or data ownership. */
export function LibraryBookPreview({ book, userId, onView, onEdit, onDelete, close }: {
  book: Book; userId?: string; onView: (id: string) => void; onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void> | void; close: () => void;
}) {
  const progress = getProgressPercentage(book);
  return <div className="library-book-preview">
    <div className="library-book-preview__identity">
      <div aria-hidden="true" className="library-book-preview__cover"><LibraryPhysicalBookCover book={book} variant="carousel" /></div>
      <div className="min-w-0">
        <LibraryStatusBadge status={book.status} />
        <h2>{book.title}</h2>
        {book.author && <p className="library-book-preview__author">by {book.author}</p>}
        <p className="mt-2 font-sans text-sm text-muted-foreground">{[book.genre, book.pages ? `${book.pages} pages` : null].filter(Boolean).join(" · ")}</p>
      </div>
    </div>
    {book.status === "reading" && Boolean(book.pages) && <div className="space-y-2">
      <p className="font-sans text-sm text-muted-foreground">Page {book.current_page || 0} of {book.pages} · {Math.round(progress)}%</p>
      <Progress value={progress} aria-label={`Reading progress for ${book.title}`} className="h-1.5" />
    </div>}
    <LibraryBookActions book={book} userId={userId} onView={onView} onEdit={onEdit}
      onDelete={async id => { await onDelete(id); close(); }} />
    {(book.description || book.notes || book.isbn || book.tags?.length || book.date_started || book.date_finished) &&
      <details className="library-book-preview__details">
        <summary>About this book</summary>
        <div className="space-y-4 pb-4">
          {book.description && <p className="font-serif text-sm leading-relaxed">{book.description}</p>}
          {book.notes && <div><h3 className="font-sans text-sm font-semibold">Your notes</h3><p className="whitespace-pre-wrap font-sans text-sm">{book.notes}</p></div>}
          <div className="grid gap-2 font-sans text-sm text-muted-foreground">
            <LibraryBookDateLine label="Started" date={book.date_started} />
            <LibraryBookDateLine label="Finished" date={book.date_finished} />
            {book.isbn && <span>ISBN {book.isbn}</span>}
            {Boolean(book.tags?.length) && <span>{book.tags!.join(", ")}</span>}
          </div>
        </div>
      </details>}
  </div>;
}
