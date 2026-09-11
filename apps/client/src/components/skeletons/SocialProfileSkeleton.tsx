import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const SocialProfileSkeleton = () => (
  <div aria-hidden="true" className="pointer-events-none space-y-6">
    <Card className="overflow-hidden"><CardContent className="p-6">
      <div className="flex flex-col items-start gap-6 sm:flex-row">
        <Skeleton className="h-24 w-24 shrink-0 rounded-full sm:h-32 sm:w-32" />
        <div className="w-full flex-1 space-y-4">
          <div className="space-y-3"><div><Skeleton className="mb-2 h-8 w-2/3 sm:h-9" /><Skeleton className="h-5 w-full sm:h-6" /></div><Skeleton className="h-11 min-h-[44px] w-32" /></div>
          <div className="flex flex-wrap gap-4 sm:gap-6"><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-24" /></div>
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
    </CardContent></Card>
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
      {["Total Books", "Books Read", "Streak", "Badges"].map((label, index) => <Card key={label}><CardHeader className="pb-2 sm:pb-3"><CardTitle className="text-xs font-medium sm:text-sm"><span className="truncate">{label}</span></CardTitle></CardHeader><CardContent><Skeleton className="h-[1.4em] w-12 text-xl sm:h-[1.3333em] sm:text-2xl" />{index === 2 && <span className="font-sans text-xs text-muted-foreground">days</span>}</CardContent></Card>)}
    </div>
    <Skeleton className="h-10 w-full" />
    <ProfileBooksSkeleton />
  </div>
);

// One visible row; the request is bounded to ten books.
export const ProfileBooksSkeleton = () => (
  <div aria-hidden="true" className="pointer-events-none grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
    {["", "", "hidden sm:block", "hidden md:block", "hidden lg:block"].map((className, index) => (
      <Card key={index} className={className} data-skeleton="profile-book"><CardContent className="p-3"><Skeleton className="mb-2 aspect-[2/3] w-full" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-2/3" /><Skeleton className="mt-1 h-4 w-3/4" /><Skeleton className="mt-2 h-6 w-16" /></CardContent></Card>
    ))}
  </div>
);

export const ProfileClubsSkeleton = () => (
  <div aria-hidden="true" className="pointer-events-none grid grid-cols-1 gap-4 md:grid-cols-2">
    {["", "hidden md:block"].map((className, index) => <Card key={index} className={className} data-skeleton="profile-club"><CardContent className="p-4"><Skeleton className="mb-2 h-7 w-3/4" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-2/3" /><Skeleton className="mt-3 h-6 w-16" /></CardContent></Card>)}
  </div>
);
