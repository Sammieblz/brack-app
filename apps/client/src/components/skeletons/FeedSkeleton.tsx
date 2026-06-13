import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ShimmerEffect } from "@/components/animations/ShimmerEffect";

export const FeedSkeleton = () => {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 bg-muted rounded-full overflow-hidden">
                <ShimmerEffect className="absolute inset-0" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="relative h-4 bg-muted rounded w-32 overflow-hidden">
                  <ShimmerEffect className="absolute inset-0" />
                </div>
                <div className="relative h-3 bg-muted rounded w-24 overflow-hidden">
                  <ShimmerEffect className="absolute inset-0" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative h-5 bg-muted rounded w-full overflow-hidden">
              <ShimmerEffect className="absolute inset-0" />
            </div>
            <div className="relative h-5 bg-muted rounded w-3/4 overflow-hidden">
              <ShimmerEffect className="absolute inset-0" />
            </div>
            <div className="relative h-48 bg-muted rounded overflow-hidden">
              <ShimmerEffect className="absolute inset-0" />
            </div>
            <div className="flex gap-4 pt-2">
              <div className="relative h-6 bg-muted rounded w-16 overflow-hidden">
                <ShimmerEffect className="absolute inset-0" />
              </div>
              <div className="relative h-6 bg-muted rounded w-20 overflow-hidden">
                <ShimmerEffect className="absolute inset-0" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
