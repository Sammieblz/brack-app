import { useSocialFeed } from "@/hooks/useSocialFeed";
import { FeedItem } from "./FeedItem";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/LoadingSpinner";
import { RefreshCw, Users, BookOpen } from "lucide-react";
import { EmptyActivity } from "@/components/empty/EmptyActivity";

export const ActivityFeed = () => {
  const { activities, loading, hasMore, loadMore, formatTimeAgo, refetchFeed } = useSocialFeed();

  if (loading && activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
        <div className="p-4 rounded-full bg-primary/10 mb-4">
          <LoadingSpinner />
        </div>
        <p className="font-sans text-sm text-muted-foreground">Loading your feed...</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return <EmptyActivity />;
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
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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
            disabled={loading}
            className="hover-scale"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More Activities'
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
