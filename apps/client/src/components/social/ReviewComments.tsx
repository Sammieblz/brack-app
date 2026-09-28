import { useId, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Trash } from "iconoir-react";
import { sanitizeText, sanitizeInput } from "@/utils/sanitize";

interface ReviewCommentsProps {
  reviewId: string;
  comments: Array<{
    id: string;
    user_id: string;
    content: string;
    created_at: string;
    profiles: {
      display_name: string | null;
      avatar_url: string | null;
    };
  }>;
  onAddComment: (content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}

export const ReviewComments = ({
  reviewId,
  comments,
  onAddComment,
  onDeleteComment,
}: ReviewCommentsProps) => {
  const id = useId();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const sanitized = sanitizeInput(newComment);
      await onAddComment(sanitized);
      setNewComment("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Comments ({comments.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment */}
        {user && (
          <div className="space-y-2">
            <Textarea
              aria-label="Comment"
              aria-describedby={submitError ? `${id}-error` : undefined}
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              className="font-sans"
            />
            {submitError && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{submitError}</p>}
            <Button
              onClick={handleSubmit}
              aria-describedby={submitError ? `${id}-error` : undefined}
              disabled={!newComment.trim() || submitting}
              size="sm"
            >
              {submitting ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        )}

        {/* Comments List */}
        <div className="space-y-4">
          {comments.length === 0 ? (
            <PremiumEmptyState
              asset="emptyComments"
              title="No comments yet"
              description="Be the first to add context to this review."
              variant="plain"
              size="compact"
            />
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 border-b pb-3 last:border-0">
                <Avatar
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => navigate(`/users/${comment.user_id}`)}
                >
                  <AvatarImage
                    src={comment.profiles.avatar_url || undefined}
                    alt={comment.profiles.display_name || "User"}
                  />
                  <AvatarFallback className="text-xs">
                    {getInitials(comment.profiles.display_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p
                        className="font-sans font-semibold text-sm cursor-pointer hover:underline"
                        onClick={() => navigate(`/users/${comment.user_id}`)}
                      >
                        {comment.profiles.display_name || "Anonymous User"}
                      </p>
                      <p className="font-sans text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {user?.id === comment.user_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onDeleteComment(comment.id)}
                      >
                        <Trash className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <p className="font-sans text-sm">{sanitizeText(comment.content)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
