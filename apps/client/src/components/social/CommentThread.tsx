import { useEffect, useId, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { usePostComments, type PostComment } from "@/hooks/usePostComments";
import { cn } from "@/lib/utils";
import { sanitizeText } from "@/utils/sanitize";
import { Trash } from "iconoir-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";

interface CommentThreadProps {
  postId: string;
  active?: boolean;
}

const initials = (name?: string | null) =>
  (name || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

// A completed request owns only the revision that it sent. Readers may keep
// writing while it is pending, including replacing it with identical text.
const useCommentDraft = (
  addComment: (content: string) => Promise<boolean>,
  kind: "Comment" | "Reply",
  onPosted?: (clearedDraft: boolean) => void,
) => {
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(0);
  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const changeContent = (value: string) => {
    revision.current += 1;
    setContent(value);
  };

  const submit = async () => {
    if (submitting.current || !content.trim()) return;
    submitting.current = true;
    const submittedRevision = revision.current;
    setPending(true);
    setError(null);
    try {
      const ok = await addComment(content);
      if (!mounted.current) return;
      if (!ok) {
        setError(`${kind} could not be posted. Your draft is still here. Try again.`);
        return;
      }
      const clearedDraft = revision.current === submittedRevision;
      if (clearedDraft) setContent("");
      onPosted?.(clearedDraft);
    } catch {
      if (mounted.current) {
        setError(`${kind} could not be posted. Your draft is still here. Try again.`);
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(false);
    }
  };

  return { content, changeContent, pending, error, submit };
};

export const CommentThread = ({ postId, active = true }: CommentThreadProps) => {
  const { user } = useAuth();
  return <CommentThreadContent key={`${user?.id ?? "guest"}:${postId}`} postId={postId} active={active} />;
};

const CommentThreadContent = ({ postId, active = true }: CommentThreadProps) => {
  const composerId = useId();
  const { comments, loading, refreshing, hasLoaded, error, refetchComments, hasMore, loadingMore, addComment, deleteComment, loadMore } =
    usePostComments(postId, undefined, active);
  const draft = useCommentDraft(addComment, "Comment");

  return (
    <div data-shell-composer-active={active} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={composerId}>Comment</Label>
        <Textarea
          id={composerId}
          value={draft.content}
          onChange={(event) => draft.changeContent(event.target.value)}
          aria-describedby={`${composerId}-help${draft.error ? ` ${composerId}-error` : ""}`}
          rows={3}
          placeholder="Add a thoughtful comment..."
          className="resize-none font-sans"
        />
        <p id={`${composerId}-help`} className="font-sans text-xs text-muted-foreground">
          Enter adds a new line. Use the Comment button to post.
        </p>
        {draft.error && <p id={`${composerId}-error`} role="alert" className="font-sans text-sm text-destructive">{draft.error}</p>}
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={draft.submit} disabled={draft.pending || !draft.content.trim()} aria-describedby={draft.error ? `${composerId}-error` : undefined}>
            {draft.pending ? "Posting..." : "Comment"}
          </Button>
        </div>
        <p role="status" className="sr-only">{draft.pending ? "Posting comment" : ""}</p>
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
              active={active}
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
  active,
}: {
  comment: PostComment;
  postId: string;
  onDelete: (commentId: string) => void;
  level?: number;
  active: boolean;
}) => {
  const { user } = useAuth();
  const composerId = useId();
  const repliesId = useId();
  const replyTriggerRef = useRef<HTMLButtonElement>(null);
  const replyComposerRef = useRef<HTMLDivElement>(null);
  const restoreReplyFocus = useRef(false);
  const [replying, setReplying] = useState(false);
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
  } = usePostComments(postId, comment.id, active && showReplies);

  const draft = useCommentDraft(
    (content) => addComment(content, comment.id),
    "Reply",
    (clearedDraft) => {
      if (clearedDraft) {
        // Restore focus only when closing the editor removed its active control.
        const focusWasInComposer = replyComposerRef.current?.contains(document.activeElement);
        setReplying(false);
        restoreReplyFocus.current = Boolean(focusWasInComposer);
      }
      setShowReplies(true);
    },
  );

  useEffect(() => {
    if (!replying && !draft.pending && restoreReplyFocus.current) {
      restoreReplyFocus.current = false;
      replyTriggerRef.current?.focus();
    }
  }, [replying, draft.pending]);

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
                ref={replyTriggerRef}
                type="button"
                onClick={(event) => {
                  event.currentTarget.focus();
                  setReplying((value) => !value);
                }}
                disabled={draft.pending}
                aria-expanded={replying}
                aria-controls={`${composerId}-region`}
                className="min-h-11 rounded-sm font-sans text-xs font-medium text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                Reply
              </button>
            )}
            {comment.reply_count > 0 && (
              <button
                type="button"
                onClick={(event) => {
                  event.currentTarget.focus();
                  setShowReplies((value) => !value);
                }}
                aria-expanded={showReplies}
                aria-controls={repliesId}
                className="min-h-11 rounded-sm font-sans text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <div ref={replyComposerRef} id={`${composerId}-region`} className="space-y-2">
              <Label htmlFor={composerId}>Reply to {comment.user?.display_name || "Reader"}</Label>
              <Textarea
                id={composerId}
                rows={2}
                value={draft.content}
                onChange={(event) => draft.changeContent(event.target.value)}
                aria-describedby={`${composerId}-help${draft.error ? ` ${composerId}-error` : ""}`}
                placeholder="Write a reply..."
                className="resize-none text-sm"
              />
              <p id={`${composerId}-help`} className="font-sans text-xs text-muted-foreground">
                Enter adds a new line. Use the Reply button to post.
              </p>
              {draft.error && <p id={`${composerId}-error`} role="alert" className="font-sans text-sm text-destructive">{draft.error}</p>}
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={draft.submit} disabled={draft.pending || !draft.content.trim()} aria-describedby={draft.error ? `${composerId}-error` : undefined}>
                  {draft.pending ? "Posting..." : "Reply"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={draft.pending}
                  onClick={() => {
                    setReplying(false);
                    replyTriggerRef.current?.focus();
                  }}
                >
                  Cancel
                </Button>
              </div>
              <p role="status" className="sr-only">{draft.pending ? "Posting reply" : ""}</p>
            </div>
          )}

          <div id={repliesId} hidden={!showReplies}>
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
                    active={active && showReplies}
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
          </div>
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
