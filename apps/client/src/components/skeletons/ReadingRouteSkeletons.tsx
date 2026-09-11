import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { APP_ICONS } from "@/config/iconography";

export const ProgressStatsSkeleton = () => (
  <div
    className="grid grid-cols-2 md:grid-cols-4 gap-4"
    data-loading-contract="progress-stats"
    aria-hidden="true"
  >
    {[
      { label: "Progress", icon: APP_ICONS.analytics.completed },
      { label: "Velocity", icon: APP_ICONS.stats.pace },
      { label: "Time Spent", icon: APP_ICONS.stats.readingTime },
      { label: "Days Left", icon: APP_ICONS.bookDetail.progressDate },
    ].map(({ label, icon: Icon }) => (
      <Card key={label}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
            <Icon className="h-4 w-4 mr-2" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-sans text-2xl font-bold">
            <Skeleton
              className="h-[1lh] w-16"
              style={{ fontSize: "inherit", lineHeight: "inherit" }}
            />
          </div>
          <div className="font-sans text-xs mt-1">
            <Skeleton
              className="h-[1lh] w-24 max-w-full"
              style={{ fontSize: "inherit", lineHeight: "inherit" }}
            />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const ReadingHistorySkeleton = () => (
  <div
    className="space-y-4"
    data-loading-contract="reading-history"
    aria-hidden="true"
  >
    {[0, 1, 2].map((index) => (
      <Card key={index}>
        <CardContent className="flex gap-4 p-4">
          <Skeleton className="h-24 w-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-1 h-5 w-1/2" />
            <Skeleton className="mt-2 h-6 w-2/3" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const EditBookSkeleton = () => (
  <Card
    className="mx-auto max-w-4xl"
    data-loading-contract="edit-book"
    aria-hidden="true"
  >
    <CardHeader>
      <Skeleton className="h-6 w-32" />
    </CardHeader>
    <CardContent className="space-y-4">
      {[0, 1].map((index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
      {[0, 1].map((row) => (
        <div
          key={row}
          className={`grid gap-4 ${row === 0 ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2"}`}
        >
          {[0, 1].map((index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </div>
      ))}
    </CardContent>
  </Card>
);

export const GoalsSkeleton = () => (
  <div
    className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]"
    data-loading-contract="goals"
    aria-hidden="true"
  >
    <section className="space-y-3">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-5 w-72 max-w-full" />
      {[0, 1].map((index) => (
        <Card key={index}>
          <CardContent className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="space-y-4">
              <Skeleton className="h-6 w-48 max-w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
            <Skeleton className="min-h-24 w-full" />
          </CardContent>
        </Card>
      ))}
    </section>
    <aside className="hidden space-y-4 xl:block">
      <Card>
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-full" />
        </CardContent>
      </Card>
    </aside>
  </div>
);
