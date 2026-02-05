import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const FeedSkeleton = () => {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded w-32" />
                <div className="h-3 bg-muted animate-pulse rounded w-24" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-5 bg-muted animate-pulse rounded w-full" />
            <div className="h-5 bg-muted animate-pulse rounded w-3/4" />
            <div className="h-48 bg-muted animate-pulse rounded" />
            <div className="flex gap-4 pt-2">
              <div className="h-6 bg-muted animate-pulse rounded w-16" />
              <div className="h-6 bg-muted animate-pulse rounded w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
