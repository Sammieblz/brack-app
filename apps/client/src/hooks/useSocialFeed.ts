import { useCallback, useEffect, useState } from "react";
import { getSocialFeed, type FeedActivity } from "@/services/api";

export type { FeedActivity };

export const useSocialFeed = (limit: number = 20) => {
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [caughtUp, setCaughtUp] = useState(false);

  const fetchFeed = useCallback(
    async (cursor: string | null = null, append = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const data = await getSocialFeed(limit, cursor);
        setActivities((current) => {
          const combined = append ? [...current, ...(data.activities || [])] : data.activities || [];
          const seen = new Set<string>();
          return combined.filter((activity) => {
            if (seen.has(activity.id)) return false;
            seen.add(activity.id);
            return true;
          });
        });
        setNextCursor(data.next_cursor ?? null);
        setHasMore(data.has_more || false);
        setCaughtUp(Boolean(data.caught_up));
      } catch (error) {
        console.error("Error fetching social feed:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const loadMore = () => {
    if (!loadingMore && hasMore && nextCursor) {
      fetchFeed(nextCursor, true);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks} week${diffInWeeks > 1 ? "s" : ""} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths} month${diffInMonths > 1 ? "s" : ""} ago`;
  };

  return {
    activities,
    loading,
    loadingMore,
    hasMore,
    caughtUp,
    loadMore,
    formatTimeAgo,
    refetchFeed: () => fetchFeed(),
  };
};
