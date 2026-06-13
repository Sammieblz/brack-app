import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const DashboardCardSkeleton = () => {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
