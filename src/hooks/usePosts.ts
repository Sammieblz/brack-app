import { useCallback, useEffect, useState } from "react";
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
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
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        const response = await getPostsFeed(cursor, PAGE_SIZE);
        applyResponse(response, append);
      } catch (error: unknown) {
        console.error("Error fetching posts:", error);
        toast.error("Failed to load posts");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [applyResponse]
  );

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

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
    if (!loadingMore && hasMore && nextCursor) {
      fetchPosts(nextCursor, true);
    }
  };

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    caughtUp,
    feedMode,
    refetchPosts,
    loadMore,
    toggleLike,
  };
};
