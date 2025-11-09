import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const BookCardSkeleton = () => {
  return (
    <Card className="p-4 hover:shadow-lg transition-shadow animate-fade-in">
      <div className="flex gap-4">
        <Skeleton className="h-24 w-16 flex-shrink-0 rounded" />
        <div className="flex-1 space-y-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>
    </Card>
  );
};
