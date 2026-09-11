import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Compact ReviewCard: book strip, reader, reaction, then footer. No invented media. */
export const ReviewCardSkeleton = () => (
  <Card aria-hidden="true" className="overflow-hidden" data-skeleton="review">
    <div className="flex gap-3 border-b border-border/70 p-4">
      <Skeleton className="h-24 w-16 shrink-0" />
      <div className="min-w-0 flex-1"><Skeleton className="h-5 w-24" /><Skeleton className="mt-2 h-6 w-3/4" /><Skeleton className="mt-1 h-5 w-1/2" /><Skeleton className="mt-2 h-4 w-1/3" /></div>
    </div>
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="min-w-0 flex-1 space-y-1"><Skeleton className="h-5 w-32 max-w-full" /><Skeleton className="h-4 w-40 max-w-full" /></div></div>
      <div><Skeleton className="h-6 w-2/3" /><Skeleton className="mt-2 h-16 w-full" /></div>
      <div className="flex gap-3 border-t border-border/70 pt-3"><Skeleton className="h-9 w-16" /><Skeleton className="h-9 w-20" /><Skeleton className="h-9 w-16" /></div>
    </div>
  </Card>
);

export const ReviewFeedSkeleton = () => <div className="space-y-4" aria-hidden="true"><ReviewCardSkeleton /><ReviewCardSkeleton /></div>;
