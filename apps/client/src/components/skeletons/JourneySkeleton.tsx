import { Skeleton } from "@/components/ui/skeleton";
import { JourneySurface } from "@/components/journey/JourneySurface";
import type { JourneyTabValue } from "@/lib/journey";

const Heading = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-36" />
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-5 w-64 max-w-full" />
  </div>
);

const QuestCard = () => (
  <div className="flex min-h-64 flex-col rounded-xl border border-border/70 bg-background/50 p-4">
    <Skeleton className="h-5 w-2/3" />
    <Skeleton className="mt-2 h-10 w-full" />
    <Skeleton className="mt-5 h-4 w-1/2" />
    <Skeleton className="mt-2 h-2 w-full" />
    <div className="mt-4 flex items-center justify-between gap-3">
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-11 w-28" />
    </div>
    <Skeleton className="mt-3 h-4 w-36" />
  </div>
);

export const JourneyBadgesSkeleton = () => (
  <div
    className="space-y-5"
    data-loading-contract="journey-badges"
    aria-hidden="true"
  >
    {[0, 1].map((rail) => (
      <div key={rail} className="flex gap-2 overflow-hidden pb-1">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-11 w-32 shrink-0 rounded-full" />
        ))}
      </div>
    ))}
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          data-skeleton-item="badge"
          className={`min-h-60 rounded-lg border border-border p-4 ${index >= 4 ? "hidden lg:block" : index >= 2 ? "hidden sm:block" : ""}`}
        >
          <Skeleton className="mx-auto h-20 w-20 rounded-full" />
          <Skeleton className="mx-auto mt-3 h-5 w-3/4" />
          <Skeleton className="mt-2 h-8 w-full" />
          <Skeleton className="mt-5 h-4 w-full" />
          <Skeleton className="mt-2 h-1.5 w-full" />
        </div>
      ))}
    </div>
  </div>
);

export const JourneyStandingsSkeleton = () => (
  <div
    className="space-y-3"
    data-loading-contract="journey-standings"
    aria-hidden="true"
  >
    <div className="journey-league-podium grid-cols-3 items-end gap-3 pt-3">
      {[0, 1, 2].map((index) => (
        <JourneySurface
          key={index}
          className={`space-y-3 p-4 ${index === 1 ? "pb-6" : ""}`}
        >
          <Skeleton className="mx-auto h-9 w-9 rounded-full" />
          <Skeleton
            className={`mx-auto rounded-full ${index === 1 ? "h-16 w-16" : "h-12 w-12"}`}
          />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mx-auto h-6 w-24" />
          <Skeleton className="h-4 w-full" />
        </JourneySurface>
      ))}
    </div>
    <JourneySurface
      variant="flat"
      className="divide-y divide-border/70 overflow-hidden"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          data-skeleton-item="standing"
          className="grid min-h-16 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 p-3"
        >
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1">
              <Skeleton className="h-5 w-32 max-w-full" />
              <Skeleton className="h-4 w-24 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-5 w-12" />
        </div>
      ))}
    </JourneySurface>
  </div>
);

export const JourneyShopSkeleton = () => (
  <div
    className="space-y-5"
    data-loading-contract="journey-shop"
    aria-hidden="true"
  >
    <JourneySurface variant="hero" className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex flex-1 items-center gap-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-2xl" />
          <Heading />
        </div>
        <Skeleton className="h-10 w-80 max-w-full" />
      </div>
    </JourneySurface>
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,21rem),1fr))]">
      {[0, 1].map((index) => (
        <JourneySurface key={index} className="min-h-72 space-y-4 p-5">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-11 w-full" />
        </JourneySurface>
      ))}
    </div>
  </div>
);

export const JourneySkeleton = ({
  tab = "overview",
}: {
  tab?: JourneyTabValue;
}) => {
  if (tab === "badges")
    return (
      <div className="space-y-5">
        <Heading />
        <JourneyBadgesSkeleton />
      </div>
    );
  if (tab === "shop") return <JourneyShopSkeleton />;
  if (tab === "rankings")
    return (
      <div className="space-y-5">
        <JourneySurface variant="hero" className="min-h-52 p-5 sm:p-6">
          <Heading />
          <Skeleton className="mt-5 h-10 w-40" />
        </JourneySurface>
        <Skeleton className="h-11 w-full max-w-xl" />
        <JourneyStandingsSkeleton />
      </div>
    );
  if (tab === "quests")
    return (
      <div
        className="space-y-5"
        data-loading-contract="journey-quests"
        aria-hidden="true"
      >
        <Heading />
        <JourneySurface variant="flat" className="p-4 sm:p-5">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="mt-1 h-5 w-64 max-w-full" />
          <div className="grid gap-3 pt-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
            {[0, 1, 2].map((index) => (
              <div key={index} className={index === 2 ? "hidden sm:block" : ""}>
                <QuestCard />
              </div>
            ))}
          </div>
        </JourneySurface>
        <JourneySurface className="p-4 sm:p-5">
          <Skeleton className="h-11 w-64 max-w-full" />
        </JourneySurface>
      </div>
    );
  return (
    <div
      className="space-y-5"
      data-loading-contract="journey-overview"
      aria-hidden="true"
    >
      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
        <JourneySurface variant="hero" className="p-5 sm:p-6">
          <Skeleton className="mb-1 h-4 w-20" />
          <Skeleton className="h-9 w-56 max-w-full sm:h-10" />
          <Skeleton className="mt-2 h-8 w-40" />
          <Skeleton className="mt-7 h-5 w-full" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-2 h-4 w-44" />
        </JourneySurface>
        <JourneySurface className="flex min-h-52 items-center gap-5 p-4 sm:p-6">
          <Skeleton className="h-16 w-16 shrink-0 rounded-2xl sm:h-20 sm:w-20" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-5 w-40 max-w-full" />
          </div>
        </JourneySurface>
      </section>
      <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
        <JourneySurface variant="hero" className="p-5 sm:p-6">
          <Skeleton className="mb-4 h-4 w-32" />
          <QuestCard />
          <Skeleton className="mt-3 h-11 w-36" />
        </JourneySurface>
        {[0, 1].map((index) => (
          <JourneySurface
            key={index}
            variant="flat"
            className="hidden space-y-4 p-5 sm:block"
          >
            <Heading />
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-5 w-full" />
          </JourneySurface>
        ))}
      </section>
    </div>
  );
};
