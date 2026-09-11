import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const DashboardCardSkeleton = ({ secondaryCount = 2 }: { secondaryCount?: number }) => {
  return (
    <div aria-hidden="true" className="space-y-3">
      <Card data-skeleton="continue-primary" className="overflow-hidden border-border/70 shadow-sm">
        <CardContent className="p-4 md:p-5">
          <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
            <Skeleton className="h-32 w-[5.5rem] sm:h-40 sm:w-28" />
            <div className="min-w-0 space-y-3">
              <div><Skeleton className="mb-1 h-[1.375rem] w-20 rounded-full" /><Skeleton className="h-6 w-4/5 sm:h-8" /><Skeleton className="mt-1 h-5 w-3/5" /></div>
              <div><Skeleton className="mb-1 h-4 w-3/5" /><Skeleton className="h-2 w-full rounded-full" /></div>
              <div className="flex flex-wrap gap-2"><Skeleton className="h-10 w-32 rounded-full" /><Skeleton className="h-10 w-28 rounded-full" /></div>
            </div>
          </div>
        </CardContent>
      </Card>
      {secondaryCount > 0 && <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))" }}>
        {Array.from({ length: secondaryCount }, (_, index) => <div key={index} data-skeleton="continue-secondary" className="flex min-h-28 gap-3 rounded-xl border border-border/70 bg-card p-3"><Skeleton className="h-20 w-14 shrink-0" /><div className="min-w-0 flex-1 space-y-2"><div><Skeleton className="h-5 w-4/5" /><Skeleton className="mt-1 h-4 w-3/5" /></div><Skeleton className="h-1.5 w-full" /><Skeleton className="h-4 w-3/5" /></div></div>)}
      </div>}
    </div>
  );
};

/** The two always-present summary cards, including the optional Journey region. */
export const DashboardSummarySkeleton = ({ showJourney = false }: { showJourney?: boolean }) => (
  <>
    <Card aria-hidden="true" data-skeleton="dashboard-streak" className="h-full overflow-hidden border-border/70">
      <CardContent className="p-0">
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_6.25rem] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-5">
            <div className="min-w-0"><Skeleton className="mb-2 h-[1.375rem] w-24 rounded-full" /><Skeleton className="h-14 w-full sm:h-16" /><Skeleton className="mt-1 h-[4.5rem] w-full" /></div><Skeleton className="aspect-square w-full rounded-full" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className={index === 2 ? "col-span-2 sm:col-span-1" : undefined}><div className="rounded-xl border border-border/60 bg-background/65 px-3 py-2.5"><Skeleton className="h-8 w-12" /><Skeleton className="h-4 w-full" /></div></div>)}</div>
          <div className="mt-4 space-y-2"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-2 w-full" /></div>
          <Skeleton className="mt-4 h-11 w-36 rounded-full" />
        </div>
        {showJourney && <div className="space-y-3 border-t border-border/60 p-4 sm:p-5"><div className="flex flex-wrap gap-3"><div className="min-w-0 flex-1"><Skeleton className="h-6 w-36" /><Skeleton className="mt-1 h-10 w-full" /></div><Skeleton className="h-11 w-28 rounded-full" /></div><Skeleton className="h-11 w-full rounded-xl" /><Skeleton className="h-[3.875rem] w-full rounded-xl" /></div>}
      </CardContent>
    </Card>
    <Card aria-hidden="true" data-skeleton="dashboard-pulse" className="h-full overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-3"><div className="flex items-center justify-between gap-3"><Skeleton className="h-7 w-32" /><Skeleton className="h-9 w-24 rounded-full" /></div></CardHeader>
      <CardContent className="space-y-4 p-4"><Skeleton className="h-8 w-full" /><div className="grid grid-cols-2 gap-3">{Array.from({ length: 2 }, (_, index) => <div key={index} className="rounded-lg border border-border/60 bg-muted/[0.25] p-3"><Skeleton className="h-8 w-12" /><Skeleton className="h-4 w-full" /></div>)}</div><div className="rounded-lg border border-border/60 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0 flex-1"><Skeleton className="h-5 w-24" /><Skeleton className="h-8 w-full" /></div><Skeleton className="h-9 w-20 rounded-full" /></div></div></CardContent>
    </Card>
  </>
);

export const DailyFocusSkeleton = () => (
  <section aria-hidden="true" data-skeleton="daily-focus" className="overflow-hidden rounded-xl border border-primary/25 bg-card shadow-sm">
    <div className="grid items-center gap-5 p-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))" }}>
      <div className="min-w-0"><Skeleton className="h-4 w-24" /><Skeleton className="mt-2 h-7 w-4/5 sm:h-8" /><Skeleton className="mt-1 h-10 w-full" /><div className="mt-4"><Skeleton className="mb-1.5 h-4 w-3/5" /><Skeleton className="h-3 w-full rounded-full" /></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2"><Skeleton className="h-[1.375rem] w-20" /><Skeleton className="h-[1.375rem] w-20" /></div></div>
      <div className="flex flex-wrap items-center gap-2"><Skeleton className="h-10 flex-1 rounded-full" /><Skeleton className="h-10 flex-1 rounded-full" /><Skeleton className="mx-auto h-[0.9375rem] w-3/4" /></div>
    </div>
  </section>
);
