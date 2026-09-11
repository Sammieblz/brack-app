import { useMemo } from "react";
import { LibraryBookCard } from "@/components/LibraryBookCard";
import { LibraryBookshelfView } from "@/components/library/LibraryBookshelfView";
import { LibraryCarouselView } from "@/components/library/LibraryCarouselView";
import { LIBRARY_FLAT_GRID } from "@/components/library/libraryLayout";
import { LibraryViewSkeleton } from "@/components/skeletons/LibraryViewSkeleton";
import type { Book } from "@/types";

const noop = () => {};

/** Production Library views with no account-scoped dialogs or data requests. */
export function LibraryModeCase({ viewMode, loading, count, book }: {
  viewMode: "flat" | "bookshelf" | "carousel";
  loading: boolean;
  count: number;
  book: Book;
}) {
  // MyBooks memoizes filteredBooks; keep the same resource identity while only
  // the fixture's refresh flag changes, including for DndKit's item registry.
  const books = useMemo(() => Array.from({ length: count }, (_, index) => ({ ...book, id: `fixture-book-${index}` })), [book, count]);
  if (loading) return <LibraryViewSkeleton viewMode={viewMode} count={count} showListAction={false} />;
  const actions = { onView: noop, onEdit: noop, onDelete: noop };
  if (viewMode === "bookshelf") return <LibraryBookshelfView books={books} {...actions} />;
  if (viewMode === "carousel") return <LibraryCarouselView books={books} {...actions} />;
  return <div className={LIBRARY_FLAT_GRID}>{books.map((item, index) => <div key={item.id} data-slot={index}><LibraryBookCard book={item} {...actions} /></div>)}</div>;
}
