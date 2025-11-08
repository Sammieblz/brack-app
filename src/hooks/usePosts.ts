import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Post {
  id: string;
  user_id: string;
  book_id?: string;
  title: string;
  content: string;
  genre?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
  book?: {
    id: string;
    title: string;
    author?: string;
    cover_url?: string;
  };
  user_has_liked?: boolean;
}

export const usePosts = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            avatar_url
          ),
          books:book_id (
            id,
            title,
            author,
            cover_url
          )
        `)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      // Check which posts the user has liked
      let likedPostIds: string[] = [];
      if (user) {
        const { data: likesData } = await supabase
          .from("post_likes")
          .select("post_id")
          .eq("user_id", user.id);

        likedPostIds = likesData?.map(like => like.post_id) || [];
      }

      const enrichedPosts: Post[] = (postsData || []).map((post: any) => ({
        id: post.id,
        user_id: post.user_id,
        book_id: post.book_id,
        title: post.title,
        content: post.content,
        genre: post.genre,
        likes_count: post.likes_count,
        comments_count: post.comments_count,
        created_at: post.created_at,
        updated_at: post.updated_at,
        user: post.profiles ? {
          id: post.profiles.id,
          display_name: post.profiles.display_name,
          avatar_url: post.profiles.avatar_url,
        } : undefined,
        book: post.books ? {
          id: post.books.id,
          title: post.books.title,
          author: post.books.author,
          cover_url: post.books.cover_url,
        } : undefined,
        user_has_liked: likedPostIds.includes(post.id),
      }));

      setPosts(enrichedPosts);
    } catch (error: any) {
      console.error("Error fetching posts:", error);
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();

    // Subscribe to new posts
    const channel = supabase
      .channel("posts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "posts",
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleLike = async (postId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.user_has_liked) {
        // Unlike
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Like
        const { error } = await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: user.id });

        if (error) throw error;
      }

      await fetchPosts();
    } catch (error: any) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update like");
    }
  };

  return { posts, loading, refetchPosts: fetchPosts, toggleLike };
};
