import { BookCardSkeleton } from "./BookCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useShelfColumns } from "@/components/library/useShelfColumns";
import { cn } from "@/lib/utils";
import { LIBRARY_FLAT_GRID, LIBRARY_CAROUSEL_ITEM } from "@/components/library/libraryLayout";

/** Unknown totals reserve only a bounded first viewport; a known zero remains zero. */
export const LibraryViewSkeleton = ({ viewMode = "flat", count, selectMode = false, showListAction = true }: {
  viewMode?: "flat" | "bookshelf" | "carousel";
  count?: number;
  selectMode?: boolean;
  showListAction?: boolean;
}) => {
  const { shelfRef, columns: rowSize } = useShelfColumns(viewMode === "bookshelf" && count !== 0);
  if (count === 0) return null;

  if (viewMode === "bookshelf") {
    const total = Math.max(0, count ?? rowSize);
    return (
      <section ref={shelfRef} aria-hidden="true" data-skeleton="library-bookshelf" className="library-bookshelf space-y-6">
        <span className="library-shelf-measure" data-shelf-measure />
        {Array.from({ length: Math.ceil(total / rowSize) }, (_, row) => (
          <div key={row} className="library-shelf-row">
            <span className="library-shelf-wall-shadow" />
            <div className="library-shelf-books" style={{ gridTemplateColumns: `repeat(${rowSize}, minmax(0, 1fr))` }}>
              {Array.from({ length: Math.min(rowSize, total - row * rowSize) }, (_, index) => (
                <div key={index} data-skeleton="shelf-book" className="library-shelf-book">
                  <Skeleton className="library-shelf-cover" />
                  <Skeleton className="mt-2 h-8 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-6 w-4/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    );
  }

  if (viewMode === "carousel") {
    return (
      <div aria-hidden="true" data-skeleton="library-carousel" className="library-carousel overflow-hidden">
        <div className="library-carousel-navigation"><Skeleton className="h-11 w-11 rounded-full" /><div className="library-carousel-position"><Skeleton className="h-11 w-full" /><Skeleton className="mx-auto mt-1 h-4 w-20" /></div><Skeleton className="h-11 w-11 rounded-full" /></div>
        <div className="overflow-hidden">
          <div className="-ml-4 flex py-1">
            {Array.from({ length: Math.max(0, count ?? 4) }, (_, index) => (
              <div key={index} className={cn("min-w-0 shrink-0 grow-0", LIBRARY_CAROUSEL_ITEM)}>
                <div data-skeleton="carousel-book" className="library-carousel-card">
                  <div className="flex-1">
                    <Skeleton className="mx-auto h-48 w-32 md:h-56 md:w-36" />
                    <Skeleton className="mt-4 h-[1.375rem] w-16 rounded-full" />
                    <Skeleton className="mt-3 h-12 w-4/5" />
                    <Skeleton className="mt-1 h-5 w-3/5" />
                    {/* Unknown genre/progress reserve one summary line, not fabricated fields. */}
                    <Skeleton className="mt-3 h-4 w-3/5" />
                  </div>
                  {!selectMode && <div className="mt-4 flex flex-wrap justify-between gap-1 border-t border-border/60 pt-3">
                    {/* Reserve the real action-label widths so wrapping matches the loaded card. */}
                    <Skeleton className="library-text-control"><span className="invisible inline-flex items-center gap-2"><span className="size-4" />Log progress</span></Skeleton>
                    <Skeleton className="library-text-control"><span className="invisible inline-flex items-center gap-2">More<span className="size-4" /></span></Skeleton>
                  </div>}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    );
  }

  return (
    <div aria-hidden="true" data-skeleton="library-flat" className={LIBRARY_FLAT_GRID}>
      {Array.from({ length: Math.max(0, count ?? 6) }, (_, index) => (
        <div key={index} className={count === undefined ? cn(index >= 2 && "hidden md:block", index >= 4 && "md:hidden 2xl:block") : undefined}>
          <BookCardSkeleton variant="library" selectMode={selectMode} showListAction={showListAction} />
        </div>
      ))}
    </div>
  );
};
