import { Skeleton } from "@/components/ui/skeleton";
import "@/components/library/collections.css";

export const BookListCardSkeleton = () => (
  <div aria-hidden="true" data-skeleton="book-list-card" className="collection-row">
    <div className="collection-destination"><Skeleton className="h-16 w-11" /><div className="space-y-3">
      <Skeleton className="h-4 w-1/2" /><Skeleton className="h-7 w-4/5" /><Skeleton className="h-10 w-full" /><Skeleton className="h-4 w-3/5" />
    </div></div><Skeleton className="size-11" />
  </div>
);
export const BookListGridSkeleton = ({ count }: { count?: number }) => (
  <div aria-hidden="true" className="collection-grid">
    {Array.from({ length: Math.max(0, count ?? 6) }, (_, index) => <BookListCardSkeleton key={index} />)}
  </div>
);
