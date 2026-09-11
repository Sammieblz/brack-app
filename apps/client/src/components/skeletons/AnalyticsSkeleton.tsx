import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_ICONS } from "@/config/iconography";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartSkeleton } from "@/components/skeletons/ChartSkeleton";

export const AnalyticsStatsSkeleton = () => (
  <div
    className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6"
    data-loading-contract="analytics-stats"
    aria-hidden="true"
  >
    {[
      { label: "Books Completed", icon: APP_ICONS.analytics.completed },
      { label: "Total Reading Time", icon: APP_ICONS.analytics.readingTime },
      { label: "Daily Average", icon: APP_ICONS.analytics.dailyAverage },
      { label: "Favorite Genre", icon: APP_ICONS.analytics.favoriteGenre },
    ].map(({ label, icon: Icon }, index) => (
      <Card key={index}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-sans text-sm font-medium">
            {label}
          </CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-sans text-2xl font-bold">
            <Skeleton
              className="h-[1lh] w-16"
              style={{ fontSize: "inherit", lineHeight: "inherit" }}
            />
          </div>
          <div className="font-sans text-xs">
            <Skeleton
              className="h-[1lh] w-32 max-w-full"
              style={{ fontSize: "inherit", lineHeight: "inherit" }}
            />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const AnalyticsSkeleton = () => {
  return (
    <div
      className="space-y-6"
      data-loading-contract="analytics"
      aria-hidden="true"
    >
      <AnalyticsStatsSkeleton />
      <Skeleton className="h-10 w-full" />
      <ChartSkeleton />
    </div>
  );
};
