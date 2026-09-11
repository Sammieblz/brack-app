import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const ConversationsSkeleton = () => (
  <div aria-hidden="true" className="pointer-events-none space-y-3">
    <Skeleton className="h-10 min-h-11 w-full" />
    <div className="space-y-2">
      {Array.from({ length: 5 }, (_, index) => (
        <Card key={index} className="border-border/70 p-3" data-skeleton="conversation">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1"><Skeleton className="mb-1 h-[1.6em] w-3/4 text-base" /><Skeleton className="h-[1.5em] w-full text-sm" /></div>
            <div className="flex shrink-0 flex-col items-end gap-2"><Skeleton className="h-[1.5em] w-10 text-xs" /><div className="h-6" /></div>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

export const MessageThreadSkeleton = ({ isMobile }: { isMobile: boolean }) => (
  <div aria-hidden="true" className="pointer-events-none flex h-full flex-col bg-card">
    {!isMobile && <div className="border-b border-border/70 bg-card/95 p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Skeleton className="h-11 w-11 rounded-full" /><div><Skeleton className="mb-1 h-5 w-28" /><Skeleton className="h-4 w-32" /></div></div><Skeleton className="h-10 min-h-11 w-16" /></div></div>}
    <div className={cn("min-h-0 flex-1 overflow-hidden", isMobile ? "p-3" : "p-5")}>
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={cn("flex gap-2", index % 2 ? "flex-row-reverse" : "")} data-skeleton="message">
            <Skeleton className="mt-1 h-9 w-9 shrink-0 rounded-full" />
            <div className="w-3/5 max-w-[82%] space-y-1 sm:max-w-[70%]">
              <Skeleton className={cn("h-4 w-16", index % 2 && "ml-auto")} />
              <div className="rounded-2xl border border-border px-3 py-2"><Skeleton className="h-[21px] w-full" /><Skeleton className="mt-1 h-[21px] w-2/3" /></div>
              <Skeleton className={cn("h-4 w-12", index % 2 && "ml-auto")} />
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className={cn("border-t border-border/70 bg-card", isMobile ? "p-3 pb-safe" : "p-4")}><div className="flex items-end gap-2"><Skeleton className="h-11 min-h-[44px] w-11 min-w-[44px] shrink-0" /><Skeleton className="h-11 min-h-[44px] w-11 min-w-[44px] shrink-0" /><Skeleton className="h-11 flex-1" /><Skeleton className="h-11 min-h-[44px] w-11 min-w-[44px] shrink-0" /></div></div>
  </div>
);
