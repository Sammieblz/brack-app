import { Card, CardContent } from "@/components/ui/card";

export const BookCardSkeleton = () => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Cover skeleton */}
          <div className="w-16 h-24 bg-muted animate-pulse rounded" />
          
          {/* Content skeleton */}
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-muted animate-pulse rounded w-3/4" />
            <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
            <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
            <div className="flex gap-2 mt-2">
              <div className="h-6 bg-muted animate-pulse rounded w-16" />
              <div className="h-6 bg-muted animate-pulse rounded w-20" />
            </div>
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
