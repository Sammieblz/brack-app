import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  addPostComment as addPostCommentApi,
  deletePostComment as deletePostCommentApi,
  fetchPostComments,
  subscribeToPostComments,
  type PostComment,
} from "@/services/api";

export type { PostComment } from "@/services/api";

export const usePostComments = (
  postId: string,
  parentId?: string | null,
  enabled = true
) => {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchComments = useCallback(
    async (cursor: string | null = null, append = false) => {
      if (!postId || !enabled) return;

      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        const response = await fetchPostComments(postId, parentId, cursor);
        setComments((current) => {
          const combined = append ? [...current, ...response.comments] : response.comments;
          const seen = new Set<string>();
          return combined.filter((comment) => {
            if (seen.has(comment.id)) return false;
            seen.add(comment.id);
            return true;
          });
        });
        setNextCursor(response.next_cursor ?? null);
        setHasMore(response.has_more);
      } catch (error: unknown) {
        console.error("Error fetching comments:", error);
        toast.error("Failed to load comments");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [enabled, parentId, postId]
  );

  useEffect(() => {
    if (!enabled) return;
    fetchComments();
    return subscribeToPostComments(postId, () => fetchComments());
  }, [enabled, fetchComments, postId]);

  const addComment = async (content: string, replyParentId?: string) => {
    try {
      await addPostCommentApi(postId, content, replyParentId || parentId || undefined);
      toast.success(replyParentId || parentId ? "Reply added" : "Comment added");
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

  const loadMore = () => {
    if (!loadingMore && hasMore && nextCursor) {
      fetchComments(nextCursor, true);
    }
  };

  return {
    comments,
    loading,
    loadingMore,
    hasMore,
    addComment,
    deleteComment,
    loadMore,
    refetchComments: () => fetchComments(),
  };
};
