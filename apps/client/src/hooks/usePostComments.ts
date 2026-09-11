import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorStatus } from "@/services/api/client";
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
  const { user } = useAuth();
  const identity = JSON.stringify([user?.id, postId, parentId]);
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  const request = useRef(0);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [requestedIdentity, setRequestedIdentity] = useState(identity);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchComments = useCallback(
    async (cursor: string | null = null, append = false) => {
      if (!postId || !enabled) return;

      const requestId = ++request.current;
      const isCurrent = () => activeIdentity.current === identity && request.current === requestId;
      try {
        setRequestedIdentity(identity);
        setError(null);
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        const response = await fetchPostComments(postId, parentId, cursor);
        if (!isCurrent()) return;
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
        setLoadedIdentity(identity);
      } catch (error: unknown) {
        if (!isCurrent()) return;
        if ([401, 403, 404].includes(getApiErrorStatus(error) ?? 0)) { setComments([]); setLoadedIdentity(null); }
        setError("Comments could not load. Please try again.");
        console.error("Error fetching comments:", error);
        toast.error("Failed to load comments");
      } finally {
        if (isCurrent()) { setLoading(false); setLoadingMore(false); }
      }
    },
    [enabled, parentId, postId, identity]
  );

  useEffect(() => {
    if (!enabled) return;
    fetchComments();
    const unsubscribe = subscribeToPostComments(postId, () => fetchComments());
    return () => { request.current += 1; unsubscribe(); };
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
    if (!loading && !loadingMore && hasMore && nextCursor && loadedIdentity === identity) {
      fetchComments(nextCursor, true);
    }
  };

  const hasLoaded = loadedIdentity === identity;
  return {
    comments: hasLoaded ? comments : [],
    hasLoaded,
    error: requestedIdentity === identity ? error : null,
    loading: !hasLoaded && (loading || requestedIdentity !== identity),
    refreshing: hasLoaded && loading,
    loadingMore,
    hasMore: hasLoaded && hasMore,
    addComment,
    deleteComment,
    loadMore,
    refetchComments: () => fetchComments(),
  };
};
