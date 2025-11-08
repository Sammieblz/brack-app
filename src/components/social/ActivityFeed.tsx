import { useSocialFeed } from "@/hooks/useSocialFeed";
import { FeedItem } from "./FeedItem";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/LoadingSpinner";
import { RefreshCw } from "lucide-react";

export const ActivityFeed = () => {
  const { activities, loading, hasMore, loadMore, formatTimeAgo, refetchFeed } = useSocialFeed();

  if (loading && activities.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          No activities yet. Follow other readers to see their updates!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={refetchFeed}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {activities.map((activity) => (
        <FeedItem
          key={activity.id}
          activity={activity}
          formatTimeAgo={formatTimeAgo}
        />
      ))}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
};
