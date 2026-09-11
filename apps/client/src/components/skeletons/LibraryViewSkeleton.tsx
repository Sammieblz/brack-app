import { BookCardSkeleton } from "./BookCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";
import { LIBRARY_FLAT_GRID, LIBRARY_CAROUSEL_ITEM, getShelfRowSize } from "@/components/library/libraryLayout";

/** Unknown totals reserve only a bounded first viewport; a known zero remains zero. */
export const LibraryViewSkeleton = ({ viewMode = "flat", count, selectMode = false, showListAction = true }: {
  viewMode?: "flat" | "bookshelf" | "carousel";
  count?: number;
  selectMode?: boolean;
  showListAction?: boolean;
}) => {
  const { width } = useBreakpoint();
  if (count === 0) return null;

  if (viewMode === "bookshelf") {
    const rowSize = getShelfRowSize(width);
    const total = Math.max(0, count ?? rowSize);
    return (
      <div aria-hidden="true" data-skeleton="library-bookshelf" className="library-bookshelf space-y-6">
        {Array.from({ length: Math.ceil(total / rowSize) }, (_, row) => (
          <div key={row} className="library-shelf-row">
            <span className="library-shelf-wall-shadow" />
            <div className="library-shelf-books" style={{ gridTemplateColumns: `repeat(${rowSize}, minmax(0, 1fr))` }}>
              {Array.from({ length: Math.min(rowSize, total - row * rowSize) }, (_, index) => (
                <div key={index} data-skeleton="shelf-book" className="library-shelf-book">
                  <Skeleton className="library-shelf-cover" />
                  <Skeleton className="mt-2 h-8 w-4/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (viewMode === "carousel") {
    return (
      <div aria-hidden="true" data-skeleton="library-carousel" className="library-carousel overflow-hidden rounded-xl border border-border/60 bg-card/55 p-3 sm:p-4">
        <div className="overflow-hidden">
          <div className="-ml-3 flex py-1">
            {Array.from({ length: Math.max(0, count ?? 4) }, (_, index) => (
              <div key={index} className={cn("min-w-0 shrink-0 grow-0", LIBRARY_CAROUSEL_ITEM)}>
                <div data-skeleton="carousel-book" className="library-carousel-card flex h-full min-h-[24rem] flex-col rounded-xl border border-border/70 bg-background/80 p-4 shadow-sm">
                  <div className="flex-1">
                    <Skeleton className="mx-auto h-48 w-32 md:h-56 md:w-36" />
                    <Skeleton className="mt-4 h-[1.375rem] w-16 rounded-full" />
                    <Skeleton className="mt-3 h-[1.55rem] w-4/5" />
                    <Skeleton className="mt-1 h-5 w-3/5" />
                  </div>
                  {!selectMode && <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-border/60 pt-3">
                    {Array.from({ length: showListAction ? 5 : 4 }, (_, action) => <Skeleton key={action} className="h-11 w-11 shrink-0 rounded-full" />)}
                  </div>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div><div className="flex h-11 items-center"><Skeleton className="mx-auto h-1.5 w-16 rounded-full" /></div><Skeleton className="h-4 w-24" /></div>
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
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
