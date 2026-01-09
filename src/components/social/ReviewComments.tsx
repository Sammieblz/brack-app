import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    const sanitized = sanitizeInput(newComment);
    await onAddComment(sanitized);
    setNewComment("");
    setSubmitting(false);
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
        <CardTitle>Comments ({comments.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment */}
        {user && (
          <div className="space-y-2">
            <Textarea
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />
            <Button
              onClick={handleSubmit}
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
            <p className="text-sm text-muted-foreground text-center py-4">
              No comments yet. Be the first to comment!
            </p>
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
                        className="font-semibold text-sm cursor-pointer hover:underline"
                        onClick={() => navigate(`/users/${comment.user_id}`)}
                      >
                        {comment.profiles.display_name || "Anonymous User"}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm">{sanitizeText(comment.content)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
