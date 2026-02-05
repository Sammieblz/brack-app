import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const AnalyticsSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted animate-pulse rounded w-24" />
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded w-16 mb-2" />
              <div className="h-3 bg-muted animate-pulse rounded w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart Skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-6 bg-muted animate-pulse rounded w-48" />
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
