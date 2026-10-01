import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import "@/components/library/collections.css";

export const BookCardSkeleton = ({ variant = "default", selectMode = false }: {
  variant?: "default" | "library" | "list-detail";
  selectMode?: boolean;
  showListAction?: boolean;
}) => {
  const isList = variant === "list-detail";
  const isLibrary = variant === "library";
  if (isList) return <div aria-hidden="true" data-skeleton="book-card" className="collection-book">
    <div className="collection-book-destination"><Skeleton className="h-24 w-16" /><div className="space-y-2">
      <Skeleton className="h-6 w-full" /><Skeleton className="h-5 w-3/5" /><Skeleton className="h-4 w-1/2" />
      <Skeleton className="mt-3 h-1.5 w-full" /><Skeleton className="h-4 w-4/5" />
    </div></div><div className="collection-book-actions"><Skeleton className="h-11 w-32" /></div>
  </div>;
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
        <div className="flex gap-3 p-4">
          <Skeleton className="h-24 w-16 shrink-0 self-center" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-[1.375rem] w-4/5" />
                <Skeleton className="mt-0.5 h-5 w-3/5" />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Skeleton className="h-[1.375rem] w-16 rounded-full" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="mt-3 h-5" />
          </div>
        </div>
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
