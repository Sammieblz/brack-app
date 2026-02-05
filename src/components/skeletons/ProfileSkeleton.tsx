import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const ProfileSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Avatar section */}
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted animate-pulse rounded w-32" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-muted animate-pulse rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-muted animate-pulse rounded w-3/4" />
              <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form fields */}
      <Card>
        <CardHeader>
          <div className="h-6 bg-muted animate-pulse rounded w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded w-24" />
              <div className="h-11 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
