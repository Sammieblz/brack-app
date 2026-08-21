import { Button } from "@/components/ui/button";
import { JourneySurface } from "@/components/journey/JourneySurface";
import type { GamificationHomeFreshness } from "@/lib/journey";

export const JourneyFreshnessNotice = ({
  freshness,
  cachedAt,
  refreshing,
  onRefresh,
}: {
  freshness: GamificationHomeFreshness;
  cachedAt?: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}) => {
  if (freshness === "live") return null;

  return (
    <JourneySurface
      variant="flat"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      role="status"
    >
      <div>
        <p className="text-sm font-medium">
          {freshness === "expired" ? "Journey needs a refresh" : "Saved Journey progress"}
        </p>
        <p className="text-xs text-muted-foreground">
          {freshness === "expired"
            ? "Your level and wallet are available, but current quests and League standings are hidden."
            : `Progress may be behind${cachedAt ? ` · Last synced ${new Date(cachedAt).toLocaleString()}` : ""}.`}
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={refreshing} onClick={onRefresh}>
        {refreshing ? "Refreshing..." : "Refresh"}
      </Button>
    </JourneySurface>
  );
};
