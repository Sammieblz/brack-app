import { useState, useEffect } from "react";
import { dataCache } from "@/services/dataCache";
import { toast } from "sonner";
import {
  fetchPosts as fetchPostsApi,
  subscribeToPosts,
  togglePostLike as togglePostLikeApi,
  type Post,
} from "@/services/api";

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export type { Post } from "@/services/api";

export const usePosts = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const enrichedPosts = await fetchPostsApi();
      setPosts(enrichedPosts);
      
      // Cache the result
      const cacheKey = 'posts_all';
      dataCache.set(cacheKey, enrichedPosts, CACHE_TTL);
    } catch (error: unknown) {
      console.error("Error fetching posts:", error);
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cacheKey = 'posts_all';
    
    // Check cache first
    const cached = dataCache.get<Post[]>(cacheKey);
    if (cached) {
      setPosts(cached);
      setLoading(false);
    } else {
      fetchPosts();
    }

    // Only subscribe to real-time updates if page is visible
    // This reduces battery drain when app is in background
    let cleanup: (() => void) | null = null;

    const setupSubscription = () => {
      if (document.hidden) return; // Don't subscribe if page is hidden

      cleanup = subscribeToPosts(() => {
        dataCache.invalidate('posts_all');
        fetchPosts();
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden - unsubscribe to save battery
        if (cleanup) {
          cleanup();
          cleanup = null;
        }
      } else {
        // Page visible - subscribe
        setupSubscription();
      }
    };

    setupSubscription();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup?.();
    };
  }, []);

  const toggleLike = async (postId: string) => {
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      await togglePostLikeApi(post);

      // Invalidate cache and refetch
      dataCache.invalidate('posts_all');
      await fetchPosts();
    } catch (error: unknown) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update like");
    }
  };

  const refetchPosts = () => {
    dataCache.invalidate('posts_all');
    fetchPosts();
  };

  return { posts, loading, refetchPosts, toggleLike };
};
