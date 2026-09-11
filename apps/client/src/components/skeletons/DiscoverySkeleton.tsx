import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const ReaderGridSkeleton = () => (
  <div aria-hidden="true" className="grid gap-3 xl:grid-cols-2" data-skeleton="reader-grid">
    {Array.from({ length: 2 }, (_, index) => (
      <Card key={index}>
        <CardContent className="flex items-start gap-3 p-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-full md:h-14 md:w-14" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-10 w-full" /></div>
              <Skeleton className="h-11 w-20 shrink-0" />
            </div>
            <Skeleton className="mt-3 h-5 w-3/4" />
            <Skeleton className="mt-3 h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const ClubCardSkeleton = () => (
  <Card aria-hidden="true" data-skeleton="club-card" className="overflow-hidden border-border/70">
    <CardContent className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="-mt-1 h-16 w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1"><Skeleton className="mb-2 h-5 w-20" /><Skeleton className="h-6 w-full" /><Skeleton className="mt-1 h-10 w-full" /></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-24" /></div>
      <Skeleton className="h-5 w-3/4" />
      <div className="mt-auto flex gap-2 border-t border-border/60 pt-3"><Skeleton className="h-11 w-28" /><Skeleton className="h-11 w-20" /></div>
    </CardContent>
  </Card>
);

/** One first-viewport row; discovery and Readers use different final breakpoints. */
export const ClubGridSkeleton = ({ readers = false }: { readers?: boolean }) => (
  <div aria-hidden="true" data-skeleton="club-grid" className={readers ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "grid gap-4 md:grid-cols-2 2xl:grid-cols-3"}>
    <ClubCardSkeleton />
    <div className="hidden md:block"><ClubCardSkeleton /></div>
    <div className={readers ? "hidden xl:block" : "hidden 2xl:block"}><ClubCardSkeleton /></div>
  </div>
);

export const ClubDetailSkeleton = () => (
  <div aria-hidden="true" className="space-y-6" data-skeleton="club-detail">
    <Card className="overflow-hidden border-border/70">
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5 sm:flex-row">
          <Skeleton className="h-24 w-24 shrink-0 rounded-2xl sm:h-28 sm:w-28" />
          <div className="min-w-0 flex-1"><Skeleton className="mb-3 h-5 w-20" /><Skeleton className="h-10 w-3/4" /><Skeleton className="mt-2 h-12 w-full" /><Skeleton className="mt-4 h-5 w-1/2" /></div>
        </div>
        <div className="rounded-xl border border-border/70 p-4"><div className="grid grid-cols-3 gap-3">{[0,1,2].map((n) => <Skeleton key={n} className="h-12 w-full" />)}</div><Skeleton className="mt-4 h-11 w-full" /></div>
      </CardContent>
    </Card>
    <Skeleton className="h-10 w-full max-w-lg" />
    <Card className="p-5"><Skeleton className="h-7 w-40" /><Skeleton className="mt-4 h-24 w-full" /></Card>
  </div>
);
