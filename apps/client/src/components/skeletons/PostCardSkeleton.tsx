import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const PostCardSkeleton = () => {
  return (
    <Card aria-hidden="true" className="pointer-events-none overflow-hidden border-border/70 bg-card/95">
      <div className="space-y-4 p-4 sm:p-5" data-skeleton="post">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-28 max-w-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="hidden h-6 w-12 sm:block" />
            <Skeleton className="h-9 min-h-11 w-9 min-w-11" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="pb-2"><Skeleton className="h-[1.25em] w-3/4 text-xl" /></div>
          <Skeleton className="h-[3lh] w-full font-serif text-sm leading-relaxed sm:h-[2lh] sm:text-base" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
          <div className="flex items-center gap-1">
            <Skeleton className="h-[calc(1.5em+1.125rem)] w-[68px] rounded-full text-sm" />
            <Skeleton className="h-10 min-h-11 w-14 rounded-full" />
            <Skeleton className="h-10 min-h-11 w-14 rounded-full" />
          </div>
        </div>
      </div>
    </Card>
  );
};
