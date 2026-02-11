import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ShimmerEffect } from "@/components/animations/ShimmerEffect";

export const AnalyticsSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="relative h-4 bg-muted rounded w-24 overflow-hidden">
                <ShimmerEffect className="absolute inset-0" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative h-8 bg-muted rounded w-16 mb-2 overflow-hidden">
                <ShimmerEffect className="absolute inset-0" />
              </div>
              <div className="relative h-3 bg-muted rounded w-32 overflow-hidden">
                <ShimmerEffect className="absolute inset-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart Skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="relative h-6 bg-muted rounded w-48 overflow-hidden">
              <ShimmerEffect className="absolute inset-0" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative h-64 bg-muted rounded overflow-hidden">
              <ShimmerEffect className="absolute inset-0" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
