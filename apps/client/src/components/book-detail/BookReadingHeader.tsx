import type { ReactNode } from "react";
import type { Book } from "@/types";
import { APP_ICONS } from "@/config/iconography";
import { AppIcon } from "@/components/ui/app-icon";
import "./book-detail.css";

/** Identity and reading actions share one DOM owner at every pane width. */
export function BookReadingHeader({ book, children }: { book: Book; children: ReactNode }) {
  const current = book.current_page ?? 0;
  const total = book.pages ?? 0;
  const percent = total > 0 ? Math.min(100, Math.max(0, Math.round(current / total * 100))) : null;
  return <section className="book-reading-header" aria-label="Book and reading actions">
    <div className="book-reading-identity">
      <div className="book-reading-cover">
        {book.cover_url
          ? <img src={book.cover_url} alt={`Cover of ${book.title}${book.author ? ` by ${book.author}` : ""}`} />
          : <AppIcon icon={APP_ICONS.dashboard.coverFallback} variant="empty" size="xl" />}
      </div>
      <div className="book-reading-title">
        <p className="book-reading-status">{book.status.replace(/_/g, " ")}</p>
        <h1>{book.title}</h1>
        {book.author && <p className="book-reading-author">{book.author}</p>}
      </div>
    </div>
    <div className="book-reading-progress">
      <div><span>{total > 0 ? `Page ${current} of ${total}` : `Page ${current}`}</span>{percent !== null && <span>{percent}%</span>}</div>
      {percent !== null
        ? <progress aria-label="Book progress" max={100} value={percent} />
        : <p>Total pages not set</p>}
    </div>
    {children}
  </section>;
}
