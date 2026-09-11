import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export const BookListCardSkeleton = () => {
  return (
    <Card aria-hidden="true" data-skeleton="book-list-card" className="overflow-hidden border-border/70 bg-card/85">
      <CardContent className="flex h-full flex-col p-4">
        <div className="min-h-[9rem]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><Skeleton className="h-6 w-4/5" /><Skeleton className="mt-1 h-4 w-3/5" /></div>
            <Skeleton className="h-[1.375rem] w-16 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-10 w-full" />
          <div className="mt-4 flex gap-2"><Skeleton className="h-[1.375rem] w-16 rounded-full" /><Skeleton className="h-[1.375rem] w-16 rounded-full" /></div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-3">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
};

export const BookListGridSkeleton = ({ count }: { count?: number }) => (
  <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: Math.max(0, count ?? 6) }, (_, index) => (
      <div key={index} className={count === undefined ? index >= 4 ? "hidden xl:block" : index >= 2 ? "hidden sm:block" : undefined : undefined}>
        <BookListCardSkeleton />
      </div>
    ))}
  </div>
);
