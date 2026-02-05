import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeInput } from "@/utils/sanitize";

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
  replies?: PostComment[];
}

export const usePostComments = (postId: string) => {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("post_comments")
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Organize comments into a tree structure
      const commentMap = new Map<string, PostComment>();
      const rootComments: PostComment[] = [];

      data?.forEach((comment: {
        id: string;
        post_id: string;
        user_id: string;
        parent_id: string | null;
        content: string;
        created_at: string;
        updated_at: string;
        profiles?: { id: string; display_name: string; avatar_url: string | null };
      }) => {
        const commentObj: PostComment = {
          id: comment.id,
          post_id: comment.post_id,
          user_id: comment.user_id,
          parent_id: comment.parent_id,
          content: comment.content,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          user: comment.profiles ? {
            id: comment.profiles.id,
            display_name: comment.profiles.display_name,
            avatar_url: comment.profiles.avatar_url,
          } : undefined,
          replies: [],
        };

        commentMap.set(comment.id, commentObj);

        if (!comment.parent_id) {
          rootComments.push(commentObj);
        }
      });

      // Build the tree
      commentMap.forEach((comment) => {
        if (comment.parent_id) {
          const parent = commentMap.get(comment.parent_id);
          if (parent) {
            parent.replies = parent.replies || [];
            parent.replies.push(comment);
          }
        }
      });

      setComments(rootComments);
    } catch (error: unknown) {
      console.error("Error fetching comments:", error);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (postId) {
      fetchComments();

      // Subscribe to comment changes
      const channel = supabase
        .channel(`post-comments-${postId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "post_comments",
            filter: `post_id=eq.${postId}`,
          },
          () => {
            fetchComments();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [postId]);

  const addComment = async (content: string, parentId?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { sanitizeInput } = await import("@/utils/sanitize");
      const sanitizedContent = sanitizeInput(content);

      const { error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          parent_id: parentId,
          content: sanitizedContent,
        });

      if (error) throw error;

      toast.success(parentId ? "Reply added!" : "Comment added!");
      await fetchComments();
      return true;
    } catch (error: unknown) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
      return false;
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast.success("Comment deleted");
      await fetchComments();
    } catch (error: unknown) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  return { comments, loading, addComment, deleteComment, refetchComments: fetchComments };
};
