import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClubDiscussion } from "@/hooks/useBookClubs";
import { MessageCircle, Trash2, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DiscussionThreadProps {
  discussion: ClubDiscussion;
  onReply: (parentId: string, content: string) => Promise<void>;
  onDelete: (discussionId: string) => Promise<void>;
  currentUserId?: string;
}

export const DiscussionThread = ({
  discussion,
  onReply,
  onDelete,
  currentUserId,
}: DiscussionThreadProps) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleReply = async () => {
    if (!replyContent.trim()) return;

    try {
      setSubmitting(true);
      await onReply(discussion.id, replyContent);
      setReplyContent("");
      setShowReplyForm(false);
    } catch (error) {
      console.error('Error posting reply:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="animate-fade-in border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3 flex-1">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src={discussion.user?.avatar_url} />
              <AvatarFallback className="bg-primary/10">
                {discussion.user?.display_name ? getInitials(discussion.user.display_name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-sans font-semibold text-sm">
                  {discussion.user?.display_name || 'Unknown User'}
                </span>
                <span className="font-sans text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })}
                </span>
              </div>
              {discussion.title && (
                <h4 className="font-display font-semibold text-foreground mb-2">
                  {discussion.title}
                </h4>
              )}
              <p className="font-serif text-sm text-foreground whitespace-pre-wrap">
                {discussion.content}
              </p>
            </div>
          </div>
          {currentUserId === discussion.user_id && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(discussion.id)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center gap-2 mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowReplyForm(!showReplyForm)}
            className="text-xs"
          >
            <MessageCircle className="h-3 w-3 mr-1" />
            Reply ({discussion.replies?.length || 0})
          </Button>
        </div>

        {/* Replies */}
        {discussion.replies && discussion.replies.length > 0 && (
          <div className="space-y-3 ml-6 border-l-2 border-border/50 pl-4">
            {discussion.replies.map((reply) => (
              <div key={reply.id} className="flex gap-3">
                <Avatar className="h-8 w-8 border border-primary/20">
                  <AvatarImage src={reply.user?.avatar_url} />
                  <AvatarFallback className="bg-primary/10 text-xs">
                    {reply.user?.display_name ? getInitials(reply.user.display_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-sans font-semibold text-xs">
                      {reply.user?.display_name || 'Unknown User'}
                    </span>
                    <span className="font-sans text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                    </span>
                    {currentUserId === reply.user_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(reply.id)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive ml-auto"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <p className="font-serif text-sm text-foreground whitespace-pre-wrap">
                    {reply.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reply Form */}
        {showReplyForm && (
          <div className="mt-3 ml-6 border-l-2 border-border/50 pl-4">
            <div className="space-y-2">
              <Textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write your reply..."
                rows={3}
                className="resize-none"
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyContent("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleReply}
                  disabled={submitting || !replyContent.trim()}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Post Reply
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
