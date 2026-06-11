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
  const [content, setContent] = useState("");
  const { comments, loading, hasMore, loadingMore, addComment, deleteComment, loadMore } =
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

      {loading ? (
        <p className="font-sans text-sm text-muted-foreground">Loading comments...</p>
      ) : comments.length === 0 ? (
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
            <div className="space-y-3 pt-1">
              {repliesLoading ? (
                <p className="font-sans text-xs text-muted-foreground">Loading replies...</p>
              ) : level >= maxInlineDepth ? (
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
