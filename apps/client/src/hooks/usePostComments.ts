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

// post-comments orders the server's serialized created_at and UUID id descending.
// Compare the complete timestamp (including sub-millisecond digits) rather than
// truncating it through Date, so a refreshed range keeps its previous boundary.
const reachesBoundary = (comment: PostComment, boundary: PostComment) =>
  comment.created_at < boundary.created_at ||
  (comment.created_at === boundary.created_at && comment.id <= boundary.id);

export const usePostComments = (
  postId: string,
  parentId?: string | null,
  enabled = true
) => {
  const { user } = useAuth();
  const identity = JSON.stringify([user?.id, postId, parentId]);
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  const activeEnabled = useRef(enabled);
  activeEnabled.current = enabled;
  const mounted = useRef(true);
  const loadedWindow = useRef<{ identity: string; comments: PostComment[] } | null>(null);
  const request = useRef(0);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const [requestedIdentity, setRequestedIdentity] = useState(identity);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const fetchComments = useCallback(
    async (cursor: string | null = null, append = false) => {
      if (!postId || !mounted.current || !activeEnabled.current || activeIdentity.current !== identity) return;

      const requestId = ++request.current;
      const isCurrent = () => mounted.current && activeEnabled.current && activeIdentity.current === identity && request.current === requestId;
      const retained = loadedWindow.current?.identity === identity ? loadedWindow.current.comments : [];
      const boundary = !append ? retained.at(-1) : undefined;
      try {
        setRequestedIdentity(identity);
        setError(null);
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }
        let response = await fetchPostComments(postId, parentId, cursor);
        if (!isCurrent()) return;
        const fresh = [...response.comments];
        const cursors = new Set<string>();
        // Re-read the range already visible before committing it. A fresh first
        // page alone can evict an older parent and its in-progress reply editor.
        // Never merge omitted stale records back into the server's new response.
        while (boundary && response.has_more && response.next_cursor &&
          !fresh.some((comment) => reachesBoundary(comment, boundary))) {
          if (cursors.has(response.next_cursor)) throw new Error("Comments pagination did not advance");
          cursors.add(response.next_cursor);
          response = await fetchPostComments(postId, parentId, response.next_cursor);
          if (!isCurrent()) return;
          fresh.push(...response.comments);
        }
        const combined = append ? [...retained, ...fresh] : fresh;
        const seen = new Set<string>();
        const next = combined.filter((comment) => {
          if (seen.has(comment.id)) return false;
          seen.add(comment.id);
          return true;
        });
        loadedWindow.current = { identity, comments: next };
        setComments(next);
        setNextCursor(response.next_cursor ?? null);
        setHasMore(response.has_more);
        setLoadedIdentity(identity);
      } catch (error: unknown) {
        if (!isCurrent()) return;
        if ([401, 403, 404].includes(getApiErrorStatus(error) ?? 0)) { loadedWindow.current = null; setComments([]); setLoadedIdentity(null); }
        setError("Comments could not load. Please try again.");
        console.error("Error fetching comments:", error);
        toast.error("Failed to load comments");
      } finally {
        if (isCurrent()) { setLoading(false); setLoadingMore(false); }
      }
    },
    [parentId, postId, identity]
  );

  useEffect(() => {
    if (!enabled) return;
    fetchComments();
    const unsubscribe = subscribeToPostComments(postId, () => fetchComments());
    return () => { request.current += 1; unsubscribe(); };
  }, [enabled, fetchComments, postId]);

  const addComment = async (content: string, replyParentId?: string) => {
    const isCurrent = () => mounted.current && activeIdentity.current === identity;
    if (!isCurrent()) return false;
    try {
      await addPostCommentApi(postId, content, replyParentId || parentId || undefined);
      if (!isCurrent()) return true;
      toast.success(replyParentId || parentId ? "Reply added" : "Comment added");
      await fetchComments();
      return true;
    } catch (error: unknown) {
      if (!isCurrent()) return false;
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
      return false;
    }
  };

  const deleteComment = async (commentId: string) => {
    const isCurrent = () => mounted.current && activeIdentity.current === identity;
    if (!isCurrent()) return;
    try {
      await deletePostCommentApi(commentId);
      if (!isCurrent()) return;
      toast.success("Comment deleted");
      await fetchComments();
    } catch (error: unknown) {
      if (!isCurrent()) return;
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
