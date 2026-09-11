import { Skeleton } from "@/components/ui/skeleton";

export const ActivityItemSkeleton = () => {
  return (
    <div aria-hidden="true" data-skeleton="activity-item" className="flex min-h-14 gap-3 rounded-lg p-2">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1"><Skeleton className="h-5 w-4/5" /><Skeleton className="mt-1 h-4 w-3/5" /></div>
      <Skeleton className="h-4 w-10 shrink-0" />
    </div>
  );
};
