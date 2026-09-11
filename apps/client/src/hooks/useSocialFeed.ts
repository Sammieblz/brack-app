import { getApiErrorStatus } from "@/services/api/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSocialFeed, type FeedActivity } from "@/services/api";

export type { FeedActivity };

export const useSocialFeed = (limit: number = 20) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const request = useRef(0);
  const failedRequest = useRef<{ cursor: string | null; append: boolean } | null>(null);
  const [loadedUser, setLoadedUser] = useState<string | null>(null);
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [caughtUp, setCaughtUp] = useState(false);

  const fetchFeed = useCallback(
    async (cursor: string | null = null, append = false) => {
      if (!userId) { setLoading(false); return; }
      const requestId = ++request.current;
      try {
        setError(null);
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const data = await getSocialFeed(limit, cursor);
        if (activeUser.current !== userId || request.current !== requestId) return;
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
        setHasLoaded(true);
        setLoadedUser(userId);
        failedRequest.current = null;
      } catch (error) {
        if (activeUser.current !== userId || request.current !== requestId) return;
        failedRequest.current = { cursor, append };
      if ([401, 403, 404].includes(getApiErrorStatus(error) ?? 0)) { setActivities([]); setHasLoaded(false); setLoadedUser(null); }
        console.error("Error fetching social feed:", error);
        setError(append ? "We couldn't load more activity." : "We couldn't load activity. Please try again.");
      } finally {
        if (activeUser.current === userId && request.current === requestId) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [limit, userId]
  );

  useEffect(() => {
    setHasLoaded(false);
    failedRequest.current = null;
    setLoadedUser(null);
    setActivities([]);
    setError(null);
    setLoading(Boolean(userId));
    setHasMore(false);
    setCaughtUp(false);
    void fetchFeed();
    return () => { request.current += 1; };
  }, [fetchFeed, userId]);

  const loadMore = () => {
    if (!loading && !loadingMore && hasMore && nextCursor) {
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
    activities: loadedUser === userId ? activities : [],
    loading,
    hasLoaded: hasLoaded && loadedUser === userId,
    error,
    loadingMore,
    hasMore,
    caughtUp,
    loadMore,
    formatTimeAgo,
    refetchFeed: () => fetchFeed(),
    retryLastRequest: () => {
      const failed = failedRequest.current;
      return failed ? fetchFeed(failed.cursor, failed.append) : fetchFeed();
    },
  };
};
