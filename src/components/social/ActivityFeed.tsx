import { useSocialFeed } from "@/hooks/useSocialFeed";
import { FeedItem } from "./FeedItem";
import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/LoadingSpinner";
import { RefreshCw, Users, BookOpen } from "lucide-react";

export const ActivityFeed = () => {
  const { activities, loading, hasMore, loadMore, formatTimeAgo, refetchFeed } = useSocialFeed();

  if (loading && activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
        <div className="p-4 rounded-full bg-primary/10 mb-4">
          <LoadingSpinner />
        </div>
        <p className="text-sm text-muted-foreground">Loading your feed...</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 max-w-md mx-auto">
          <div className="p-4 rounded-full bg-primary/20 w-fit mx-auto mb-4">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Your feed is empty</h3>
          <p className="text-muted-foreground mb-6">
            Follow other readers to see their reading activities and updates!
          </p>
          <Button variant="default" className="hover-scale">
            <BookOpen className="h-4 w-4 mr-2" />
            Discover Readers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6 p-4 rounded-lg bg-muted/30 border border-border/40">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">
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
