import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookCardSkeleton } from "./BookCardSkeleton";

export const BOOK_DETAIL_GRID = "grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]";

export const BookDetailSkeleton = () => (
  <div aria-hidden="true" data-skeleton="book-detail" className={BOOK_DETAIL_GRID}>
    <div className="min-w-0 space-y-5">
      <Card className="overflow-hidden border-border/70 bg-card/80 shadow-sm">
        <CardContent className="p-4 sm:p-5 md:p-6">
          <div className="grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)] md:gap-6">
            <Skeleton className="mx-auto aspect-[2/3] w-32 sm:mx-0 sm:w-36" />
            <div className="min-w-0 space-y-4">
              <div className="space-y-2"><Skeleton className="mx-auto h-[1.375rem] w-24 rounded-full sm:mx-0" /><Skeleton className="h-9 w-full md:h-10" /><Skeleton className="mx-auto h-7 w-3/5 sm:mx-0" /></div>
              <div className="rounded-lg border border-border/70 bg-background/45 p-4">
                <Skeleton className="mb-2 h-5 w-3/5" /><Skeleton className="h-2 w-full rounded-full" />
                <div className="mt-3 grid grid-cols-3 gap-3">{Array.from({ length: 3 }, (_, index) => <div key={index}><Skeleton className="mx-auto h-6 w-8" /><Skeleton className="mx-auto h-4 w-full max-w-16" /></div>)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4"><Skeleton className="h-10 w-full" /><Card className="border-border/70 bg-card/80"><CardHeader><Skeleton className="h-7 w-28" /></CardHeader><CardContent className="space-y-5"><Skeleton className="h-28 w-full" /><div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div></CardContent></Card></div>
    </div>
    <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
      <Card className="border-border/70 bg-card/85 shadow-sm"><CardHeader><Skeleton className="h-7 w-40" /></CardHeader><CardContent className="space-y-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-10 w-full rounded-full" />)}<div className="flex flex-wrap gap-2 pt-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-10 w-10 rounded-full" />)}</div></CardContent></Card>
      <Card className="border-border/70 bg-card/85 shadow-sm"><CardHeader><Skeleton className="h-7 w-32" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-9 w-full" /><div className="grid grid-cols-2 gap-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-[4.125rem] w-full" />)}</div></CardContent></Card>
    </aside>
  </div>
);

export const BookListDetailSkeleton = ({ count }: { count?: number }) => (
  <div aria-hidden="true" data-skeleton="book-list-detail" className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><Skeleton className="mb-2 h-9 w-3/5" /><Skeleton className="h-6 w-4/5" /><Skeleton className="mt-2 h-5 w-16" /></div><Skeleton className="h-10 w-full rounded-full sm:w-28" /></div>
    {count !== 0 && <>
      <div className="rounded-xl border border-border/60 bg-card/60 p-3"><Skeleton className="h-5 w-28" /><Skeleton className="mt-1 h-5 w-full max-w-md" /></div>
      <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: Math.max(0, count ?? 6) }, (_, index) => <div key={index} className={count === undefined ? index >= 4 ? "hidden xl:block" : index >= 2 ? "hidden sm:block" : undefined : undefined}><BookCardSkeleton variant="list-detail" /></div>)}
      </div>
    </>}
  </div>
);
