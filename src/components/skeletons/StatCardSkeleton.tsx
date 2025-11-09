import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export const StatCardSkeleton = () => {
  return (
    <Card className="animate-fade-in">
      <CardContent className="p-4 text-center space-y-2">
        <Skeleton className="h-8 w-16 mx-auto" />
        <Skeleton className="h-3 w-24 mx-auto" />
      </CardContent>
    </Card>
  );
};
