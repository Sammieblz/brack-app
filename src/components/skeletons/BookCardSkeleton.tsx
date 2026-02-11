import { Card, CardContent } from "@/components/ui/card";
import { ShimmerEffect } from "@/components/animations/ShimmerEffect";

export const BookCardSkeleton = () => {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Cover skeleton */}
          <div className="relative w-16 h-24 bg-muted rounded overflow-hidden">
            <ShimmerEffect className="absolute inset-0" />
          </div>
          
          {/* Content skeleton */}
          <div className="flex-1 space-y-2">
            <div className="relative h-5 bg-muted rounded w-3/4 overflow-hidden">
              <ShimmerEffect className="absolute inset-0" />
            </div>
            <div className="relative h-4 bg-muted rounded w-1/2 overflow-hidden">
              <ShimmerEffect className="absolute inset-0" />
            </div>
            <div className="relative h-4 bg-muted rounded w-2/3 overflow-hidden">
              <ShimmerEffect className="absolute inset-0" />
            </div>
            <div className="flex gap-2 mt-2">
              <div className="relative h-6 bg-muted rounded w-16 overflow-hidden">
                <ShimmerEffect className="absolute inset-0" />
              </div>
              <div className="relative h-6 bg-muted rounded w-20 overflow-hidden">
                <ShimmerEffect className="absolute inset-0" />
              </div>
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
