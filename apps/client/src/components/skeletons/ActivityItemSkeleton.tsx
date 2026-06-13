import { Skeleton } from "@/components/ui/skeleton";

export const ActivityItemSkeleton = () => {
  return (
    <div className="flex items-center space-x-3 animate-fade-in">
      <Skeleton className="w-2 h-2 rounded-full" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
};
