import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const FeedSkeleton = () => {
  return (
    <div aria-hidden="true" className="pointer-events-none space-y-4">
      <div className="mb-6 flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 p-4">
        <Skeleton className="h-[1.5em] w-24 text-sm" /><Skeleton className="h-10 min-h-11 w-24" />
      </div>
      <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50">
          <CardContent className="p-5" data-skeleton="activity">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="mb-2 space-y-1"><Skeleton className="h-[21px] w-full" /><Skeleton className="h-[21px] w-2/3" /></div>
                <Skeleton className="mt-3 h-4 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
};
