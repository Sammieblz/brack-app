import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { usePostComments, type PostComment } from "@/hooks/usePostComments";
import { cn } from "@/lib/utils";
import { sanitizeText } from "@/utils/sanitize";
import { Trash } from "iconoir-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";

interface CommentThreadProps {
  postId: string;
}

const initials = (name?: string | null) =>
  (name || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

export const CommentThread = ({ postId }: CommentThreadProps) => {
  const { user } = useAuth();
  return <CommentThreadContent key={`${user?.id ?? "guest"}:${postId}`} postId={postId} />;
};

const CommentThreadContent = ({ postId }: CommentThreadProps) => {
  const [content, setContent] = useState("");
  const { comments, loading, refreshing, hasLoaded, error, refetchComments, hasMore, loadingMore, addComment, deleteComment, loadMore } =
    usePostComments(postId);

  const submit = async () => {
    if (!content.trim()) return;
    const ok = await addComment(content);
    if (ok) setContent("");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          placeholder="Add a thoughtful comment..."
          className="resize-none font-sans"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={!content.trim()}>
            Comment
          </Button>
        </div>
      </div>

      <LoadingRegion loading={loading} refreshing={refreshing} label="Loading comments">
      {error && <LoadingError message={error} onRetry={refetchComments} />}
      {loading ? (
        <CommentListSkeleton />
      ) : !hasLoaded ? null : comments.length === 0 ? (
        <PremiumEmptyState
          asset="emptyComments"
          title="No comments yet"
          description="Start the thread with a useful response."
          variant="plain"
          size="compact"
          className="rounded-md border border-dashed border-border/70"
        />
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              postId={postId}
              onDelete={deleteComment}
            />
          ))}
        </div>
      )}
      </LoadingRegion>

      {hasMore && (
        <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading..." : "Load more comments"}
        </Button>
      )}
    </div>
  );
};

const CommentNode = ({
  comment,
  postId,
  onDelete,
  level = 0,
}: {
  comment: PostComment;
  postId: string;
  onDelete: (commentId: string) => void;
  level?: number;
}) => {
  const { user } = useAuth();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [showReplies, setShowReplies] = useState(false);
  const {
    comments: replies,
    loading: repliesLoading,
    refreshing: repliesRefreshing,
    hasLoaded: repliesLoaded,
    error: repliesError,
    refetchComments: refetchReplies,
    hasMore,
    loadingMore,
    addComment,
    deleteComment,
    loadMore,
  } = usePostComments(postId, comment.id, showReplies);

  const submitReply = async () => {
    if (!reply.trim()) return;
    const ok = await addComment(reply, comment.id);
    if (ok) {
      setReply("");
      setReplying(false);
      setShowReplies(true);
    }
  };

  const isDeleted = comment.is_deleted || Boolean(comment.deleted_at);
  const maxInlineDepth = 3;

  return (
    <div
      className={cn(
        "rounded-md border border-border/60 bg-card/60 p-3",
        level > 0 && "ml-4 border-l-primary/30 sm:ml-6"
      )}
    >
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          {!isDeleted && <AvatarImage src={comment.user?.avatar_url || undefined} />}
          <AvatarFallback className="text-xs">
            {isDeleted ? "..." : initials(comment.user?.display_name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-sans text-sm font-semibold">
                {isDeleted ? "Deleted comment" : comment.user?.display_name || "Reader"}
              </p>
              <span className="font-sans text-xs text-muted-foreground">
                {new Date(comment.created_at).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap font-serif text-sm leading-relaxed text-foreground">
              {isDeleted ? "This comment was deleted." : sanitizeText(comment.content)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isDeleted && (
              <button
                type="button"
                onClick={() => setReplying((value) => !value)}
                className="font-sans text-xs font-medium text-muted-foreground hover:text-primary"
              >
                Reply
              </button>
            )}
            {comment.reply_count > 0 && (
              <button
                type="button"
                onClick={() => setShowReplies((value) => !value)}
                className="font-sans text-xs font-medium text-primary"
              >
                {showReplies ? "Hide replies" : `View ${comment.reply_count} replies`}
              </button>
            )}
            {user?.id === comment.user_id && !isDeleted && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="inline-flex items-center gap-1 font-sans text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash className="h-3 w-3" />
                Delete
              </button>
            )}
          </div>

          {replying && (
            <div className="space-y-2">
              <Textarea
                rows={2}
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Write a reply..."
                className="resize-none text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={submitReply} disabled={!reply.trim()}>
                  Reply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReply("");
                    setReplying(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {showReplies && (
            <LoadingRegion loading={repliesLoading} refreshing={repliesRefreshing} label="Loading replies" className="space-y-3 pt-1">
              {repliesError && <LoadingError message={repliesError} onRetry={refetchReplies} />}
              {repliesLoading ? (
                <CommentListSkeleton replies />
              ) : !repliesLoaded ? null : level >= maxInlineDepth ? (
                <p className="rounded-md bg-muted/50 p-2 font-sans text-xs text-muted-foreground">
                  Continue thread from this reply.
                </p>
              ) : (
                replies.map((replyComment) => (
                  <CommentNode
                    key={replyComment.id}
                    comment={replyComment}
                    postId={postId}
                    onDelete={deleteComment}
                    level={level + 1}
                  />
                ))
              )}
              {hasMore && level < maxInlineDepth && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load more replies"}
                </Button>
              )}
            </LoadingRegion>
          )}
        </div>
      </div>
    </div>
  );
};

const CommentListSkeleton = ({ replies = false }: { replies?: boolean }) => (
  <div aria-hidden="true" className="pointer-events-none space-y-3">
    {Array.from({ length: replies ? 1 : 2 }, (_, index) => <div key={index} data-skeleton="comment" className={cn("rounded-md border border-border/60 bg-card/60 p-3", replies && "ml-4 border-l-primary/30 sm:ml-6")}><div className="flex gap-3"><Skeleton className="h-8 w-8 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><div><div className="flex flex-wrap items-center gap-2"><Skeleton className="h-[1.5em] w-20 text-sm" /><Skeleton className="h-[1.5em] w-12 text-xs" /></div><Skeleton className="mt-1 h-[2lh] w-full font-serif text-sm leading-relaxed" /></div><Skeleton className="h-[1.5em] w-10 text-xs" /></div></div></div>)}
  </div>
);
