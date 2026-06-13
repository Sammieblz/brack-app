import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ShimmerEffect } from "@/components/animations/ShimmerEffect";

export const ProfileSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Avatar section */}
      <Card>
        <CardHeader>
          <div className="relative h-6 bg-muted rounded w-32 overflow-hidden">
            <ShimmerEffect className="absolute inset-0" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 bg-muted rounded-full overflow-hidden">
              <ShimmerEffect className="absolute inset-0" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="relative h-5 bg-muted rounded w-3/4 overflow-hidden">
                <ShimmerEffect className="absolute inset-0" />
              </div>
              <div className="relative h-4 bg-muted rounded w-1/2 overflow-hidden">
                <ShimmerEffect className="absolute inset-0" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form fields */}
      <Card>
        <CardHeader>
          <div className="relative h-6 bg-muted rounded w-40 overflow-hidden">
            <ShimmerEffect className="absolute inset-0" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="relative h-4 bg-muted rounded w-24 overflow-hidden">
                <ShimmerEffect className="absolute inset-0" />
              </div>
              <div className="relative h-11 bg-muted rounded overflow-hidden">
                <ShimmerEffect className="absolute inset-0" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
