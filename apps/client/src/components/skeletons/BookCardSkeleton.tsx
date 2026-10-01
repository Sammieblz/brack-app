import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import "@/components/library/library-reading-room.css";

export const BookCardSkeleton = ({ variant = "default", selectMode = false }: {
  variant?: "default" | "library" | "list-detail";
  selectMode?: boolean;
  showListAction?: boolean;
}) => {
  const isList = variant === "list-detail";
  const isLibrary = variant === "library";
  if (isLibrary) return <div aria-hidden="true" data-skeleton="book-card" className="library-reading-row">
    <div className="library-reading-row__body"><Skeleton className="h-24 w-16" /><div className="space-y-2">
      <Skeleton className="h-6 w-4/5" /><Skeleton className="h-5 w-3/5" /><Skeleton className="h-4 w-1/2" />
      <Skeleton className="mt-3 h-1 w-full" /><Skeleton className="h-4 w-3/5" />
    </div></div>
    {!selectMode && <div className="mt-3 flex justify-between gap-2"><Skeleton className="h-11 w-28" /><Skeleton className="h-11 w-20" /></div>}
  </div>;
  return (
    <Card aria-hidden="true" data-skeleton="book-card" className="overflow-hidden border-border/70 bg-card/85 shadow-sm">
      <CardContent className="p-0">
        <div className={cn("flex gap-3", isLibrary || isList ? "p-3 sm:p-4" : "p-4", isLibrary && "min-h-[8.75rem]", isList && "min-h-[9.5rem]")}>
          {isList && <Skeleton className="mt-1 h-10 w-10 shrink-0 rounded-full" />}
          <Skeleton className={cn("h-24 w-16 shrink-0 self-center", isLibrary && "md:h-28 md:w-[4.5rem]", isList && "sm:h-28 sm:w-[4.5rem]")} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-[1.375rem] w-4/5" />
                <Skeleton className="mt-0.5 h-5 w-3/5" />
              </div>
              {(isLibrary || isList) && <Skeleton className={cn("shrink-0 rounded-full", isLibrary ? "h-11 w-11" : "h-9 w-9")} />}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Skeleton className="h-[1.375rem] w-16 rounded-full" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="mt-3 h-5" />
          </div>
        </div>
        {isList && <div className="border-t border-border/55 bg-background/35 px-3 py-2 sm:px-4"><Skeleton className="h-11 w-full rounded-full" /></div>}
      </CardContent>
    </Card>
  );
};

export const BookGridSkeleton = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <BookCardSkeleton key={i} />
      ))}
    </div>
  );
};
