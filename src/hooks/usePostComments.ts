import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  addPostComment as addPostCommentApi,
  deletePostComment as deletePostCommentApi,
  fetchPostComments,
  subscribeToPostComments,
  type PostComment,
} from "@/services/api";

export type { PostComment } from "@/services/api";

export const usePostComments = (postId: string) => {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = async () => {
    try {
      setLoading(true);
      setComments(await fetchPostComments(postId));
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

      return subscribeToPostComments(postId, fetchComments);
    }
  }, [postId]);

  const addComment = async (content: string, parentId?: string) => {
    try {
      await addPostCommentApi(postId, content, parentId);

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
      await deletePostCommentApi(commentId);

      toast.success("Comment deleted");
      await fetchComments();
    } catch (error: unknown) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  return { comments, loading, addComment, deleteComment, refetchComments: fetchComments };
};
