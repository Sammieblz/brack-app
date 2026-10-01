import { Skeleton } from "@/components/ui/skeleton";
import { BookCardSkeleton } from "./BookCardSkeleton";
import "@/components/book-detail/book-detail.css";

export const BookDetailSkeleton = () => (
  <div aria-hidden="true" data-skeleton="book-detail" className="book-detail-layout">
    <div className="book-reading-header">
      <div className="book-reading-identity">
        <Skeleton className="book-reading-cover" />
        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-14 w-full" /><Skeleton className="h-6 w-3/4" /></div>
      </div>
      <div className="book-reading-progress"><Skeleton className="h-5 w-3/5" /><Skeleton className="mt-2 h-1.5 w-full" /></div>
      <div className="book-reading-actions"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div>
      <div className="book-detail-management"><Skeleton className="h-11 w-full" /></div>
    </div>
    <div className="book-detail-content space-y-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-6 w-28" /><Skeleton className="h-28 w-full" /><div className="book-detail-metadata"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div></div>
  </div>
);

export const BookListDetailSkeleton = ({ count }: { count?: number }) => (
  <div aria-hidden="true" data-skeleton="book-list-detail" className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><Skeleton className="mb-2 h-9 w-3/5" /><Skeleton className="h-6 w-4/5" /><Skeleton className="mt-2 h-5 w-16" /></div><Skeleton className="h-10 w-full rounded-full sm:w-28" /></div>
    {count !== 0 && <>
      <div className="collection-order-toolbar"><Skeleton className="h-5 w-28" /><Skeleton className="h-11 w-20" /></div>
      <div className="collection-grid">
        {Array.from({ length: Math.max(0, count ?? 6) }, (_, index) => <BookCardSkeleton key={index} variant="list-detail" />)}
      </div>
    </>}
  </div>
);
