import { useSocialFeed } from "@/hooks/useSocialFeed";
import { FeedItem } from "./FeedItem";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/LoadingSpinner";
import { EmptyActivity } from "@/components/empty/EmptyActivity";
import { AppIcon } from "@/components/ui/app-icon";
import { APP_ICONS } from "@/config/iconography";

export const ActivityFeed = () => {
  const {
    activities,
    loading,
    loadingMore,
    hasMore,
    caughtUp,
    loadMore,
    formatTimeAgo,
    refetchFeed,
  } = useSocialFeed();

  if (loading && activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
        <div className="mb-4">
          <LoadingSpinner />
        </div>
        <p className="font-sans text-sm text-muted-foreground">Loading your feed...</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyActivity />
        <div className="rounded-md border border-dashed border-border/70 p-4 text-center">
          <p className="font-sans text-sm text-muted-foreground">
            Activity now only shows mutual-follow friends who have reading activity enabled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6 p-4 rounded-lg bg-muted/30 border border-border/40">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-sans text-sm text-muted-foreground">
            {activities.length} {activities.length === 1 ? 'update' : 'updates'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refetchFeed}
          disabled={loading}
          className="hover-scale"
        >
          <AppIcon
            icon={APP_ICONS.common.refresh}
            variant="inline"
            size="sm"
            className={`mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {activities.map((activity, index) => (
          <div 
            key={activity.id}
            className="animate-fade-in"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <FeedItem
              activity={activity}
              formatTimeAgo={formatTimeAgo}
            />
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-6">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
            className="hover-scale"
          >
            {loadingMore ? (
              <>
                <AppIcon icon={APP_ICONS.common.refresh} variant="inline" size="sm" className="mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More Activities'
            )}
          </Button>
        </div>
      )}

      {!hasMore && caughtUp && (
        <div className="rounded-md border border-dashed border-border/70 p-4 text-center">
          <p className="font-sans text-sm text-muted-foreground">
            You're caught up with friend activity.
          </p>
        </div>
      )}
    </div>
  );
};
