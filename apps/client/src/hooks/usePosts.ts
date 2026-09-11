import { getApiErrorStatus } from "@/services/api/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getPostsFeed,
  togglePostLike as togglePostLikeApi,
  type Post,
  type PostsFeedResponse,
} from "@/services/api";

export type { Post } from "@/services/api";

const PAGE_SIZE = 20;

export const usePosts = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const request = useRef(0);
  const failedRequest = useRef<{ cursor: string | null; append: boolean } | null>(null);
  const [loadedUser, setLoadedUser] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [caughtUp, setCaughtUp] = useState(false);
  const [feedMode, setFeedMode] = useState<PostsFeedResponse["feed_mode"]>("following");

  const applyResponse = useCallback(
    (response: PostsFeedResponse, append: boolean) => {
      setPosts((current) => {
        const combined = append ? [...current, ...response.items] : response.items;
        const seen = new Set<string>();
        return combined.filter((post) => {
          if (seen.has(post.id)) return false;
          seen.add(post.id);
          return true;
        });
      });
      setNextCursor(response.next_cursor ?? null);
      setHasMore(response.has_more);
      setCaughtUp(response.caught_up);
      setFeedMode(response.feed_mode);
    },
    []
  );

  const fetchPosts = useCallback(
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
        const response = await getPostsFeed(cursor, PAGE_SIZE);
        if (activeUser.current !== userId || request.current !== requestId) return;
        applyResponse(response, append);
        setHasLoaded(true);
        setLoadedUser(userId);
        failedRequest.current = null;
      } catch (error: unknown) {
        if (activeUser.current !== userId || request.current !== requestId) return;
        failedRequest.current = { cursor, append };
      if ([401, 403, 404].includes(getApiErrorStatus(error) ?? 0)) { setPosts([]); setHasLoaded(false); setLoadedUser(null); }
        console.error("Error fetching posts:", error);
        toast.error("Failed to load posts");
        setError(append ? "We couldn't load more posts." : "We couldn't load posts. Please try again.");
      } finally {
        if (activeUser.current === userId && request.current === requestId) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [applyResponse, userId]
  );

  useEffect(() => {
    setHasLoaded(false);
    failedRequest.current = null;
    setLoadedUser(null);
    setPosts([]);
    setError(null);
    setLoading(Boolean(userId));
    setHasMore(false);
    setCaughtUp(false);
    void fetchPosts();
    return () => { request.current += 1; };
  }, [fetchPosts, userId]);

  const toggleLike = async (postId: string) => {
    const post = posts.find((candidate) => candidate.id === postId);
    if (!post) return;

    setPosts((current) =>
      current.map((candidate) =>
        candidate.id === postId
          ? {
              ...candidate,
              user_has_liked: !candidate.user_has_liked,
              likes_count: Math.max(
                0,
                (candidate.likes_count || 0) + (candidate.user_has_liked ? -1 : 1)
              ),
            }
          : candidate
      )
    );

    try {
      const result = await togglePostLikeApi(postId);
      setPosts((current) =>
        current.map((candidate) =>
          candidate.id === postId
            ? {
                ...candidate,
                user_has_liked: result.liked,
                likes_count: result.likes_count,
              }
            : candidate
        )
      );
    } catch (error: unknown) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update like");
      setPosts((current) =>
        current.map((candidate) => (candidate.id === postId ? post : candidate))
      );
    }
  };

  const refetchPosts = () => fetchPosts();
  const loadMore = () => {
    if (!loading && !loadingMore && hasMore && nextCursor) {
      fetchPosts(nextCursor, true);
    }
  };

  return {
    posts: loadedUser === userId ? posts : [],
    loading,
    hasLoaded: hasLoaded && loadedUser === userId,
    error,
    loadingMore,
    hasMore,
    caughtUp,
    feedMode,
    refetchPosts,
    retryLastRequest: () => {
      const failed = failedRequest.current;
      return failed ? fetchPosts(failed.cursor, failed.append) : fetchPosts();
    },
    loadMore,
    toggleLike,
  };
};
