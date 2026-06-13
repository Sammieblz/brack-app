import { OptimizedImage } from "@/components/OptimizedImage";
import { APP_ICONS } from "@/config/iconography";
import { cn } from "@/lib/utils";
import type { Book } from "@/types";

interface LibraryPhysicalBookCoverProps {
  book: Book;
  variant?: "card" | "carousel";
  className?: string;
}

export const LibraryPhysicalBookCover = ({
  book,
  variant = "card",
  className,
}: LibraryPhysicalBookCoverProps) => (
  <span
    className={cn(
      "library-physical-book",
      variant === "card" && "library-physical-book-card",
      variant === "carousel" && "library-physical-book-carousel",
      className
    )}
  >
    <span className="library-physical-book-pages" aria-hidden="true" />
    <span className="library-physical-book-face">
      {book.cover_url ? (
        <OptimizedImage
          src={book.cover_url}
          alt={book.title}
          className="library-physical-book-image"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-[0.28rem] bg-primary/10 text-primary">
          <APP_ICONS.dashboard.coverFallback className="h-7 w-7" />
        </span>
      )}
    </span>
  </span>
);
