import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Trash2, Edit, Flag, Share2 } from "lucide-react";
import { HeartLike } from "@/components/animations/HeartLike";
import { Post } from "@/hooks/usePosts";
import { usePostComments, PostComment } from "@/hooks/usePostComments";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ContextMenuNative } from "@/components/ui/context-menu-native";
import { sanitizeText } from "@/utils/sanitize";

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onDelete?: (postId: string) => void;
}

const CommentItem = ({ 
  comment, 
  onReply, 
  onDelete,
  currentUserId,
  level = 0 
}: { 
  comment: PostComment; 
  onReply: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  currentUserId?: string;
  level?: number;
}) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    await onReply(comment.id, replyContent);
    setReplyContent("");
    setShowReplyForm(false);
  };

  return (
    <div className={`${level > 0 ? "ml-8 mt-3" : "mt-4"}`}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={comment.user?.avatar_url} />
          <AvatarFallback className="text-xs">
            {getInitials(comment.user?.display_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="bg-muted rounded-lg px-3 py-2">
            <p className="font-semibold text-sm">{comment.user?.display_name || "Unknown User"}</p>
            <p className="text-sm mt-1">{sanitizeText(comment.content)}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 ml-3">
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reply
            </button>
            {currentUserId === comment.user_id && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(comment.created_at).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })}
            </span>
          </div>

          {showReplyForm && (
            <div className="mt-2 ml-3 space-y-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleReply}>
                  Reply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyContent("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div>
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  onReply={onReply}
                  onDelete={onDelete}
                  currentUserId={currentUserId}
                  level={level + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PostCard = ({ post, onLike, onDelete }: PostCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const { comments, addComment, deleteComment } = usePostComments(post.id);
  const { user } = useAuth();

  const handleDeletePost = async () => {
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);

      if (error) throw error;

      toast.success("Post deleted");
      onDelete?.(post.id);
    } catch (error: unknown) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    }
  };

  const contextActions = user?.id === post.user_id ? [
    {
      label: "Edit Post",
      icon: <Edit className="h-5 w-5" />,
      onClick: () => {
        toast.info("Edit feature coming soon");
      },
    },
    {
      label: "Share",
      icon: <Share2 className="h-5 w-5" />,
      onClick: () => {
        if (navigator.share) {
          navigator.share({
            title: post.title,
            text: post.content,
          });
        }
      },
    },
    {
      label: "Delete Post",
      icon: <Trash2 className="h-5 w-5" />,
      variant: 'destructive' as const,
      onClick: handleDeletePost,
    },
  ] : [
    {
      label: "Share",
      icon: <Share2 className="h-5 w-5" />,
      onClick: () => {
        if (navigator.share) {
          navigator.share({
            title: post.title,
            text: post.content,
          });
        }
      },
    },
    {
      label: "Report",
      icon: <Flag className="h-5 w-5" />,
      variant: 'destructive' as const,
      onClick: () => {
        toast.success("Post reported. Thank you for keeping our community safe.");
      },
    },
  ];

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const handleAddComment = async () => {
    if (!commentContent.trim()) return;
    const sanitized = sanitizeInput(commentContent);
    const success = await addComment(sanitized);
    if (success) {
      setCommentContent("");
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    const sanitized = sanitizeInput(content);
    await addComment(sanitized, parentId);
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    
    // If today, show just the time
    if (diffInHours < 24 && date.getDate() === now.getDate()) {
      return timeStr;
    }
    
    // If yesterday
    if (diffInHours < 48 && date.getDate() === now.getDate() - 1) {
      return `Yesterday ${timeStr}`;
    }
    
    // If within the last week, show day name
    if (diffInHours < 168) {
      const dayName = date.toLocaleDateString([], { weekday: "short" });
      return `${dayName} ${timeStr}`;
    }
    
    // Otherwise show full date
    return date.toLocaleDateString([], { 
      month: "short", 
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined 
    }) + " " + timeStr;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return formatTimestamp(dateString);
  };

  return (
    <ContextMenuNative
      actions={contextActions}
      title="Post Options"
      description="Choose an action"
    >
      <Card className="p-6 hover-scale active:scale-[0.98] transition-all duration-200">
      <div className="flex gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={post.user?.avatar_url} />
          <AvatarFallback>{getInitials(post.user?.display_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-semibold">{post.user?.display_name || "Unknown User"}</p>
              <p className="text-sm text-muted-foreground">{formatDate(post.created_at)}</p>
            </div>
            {user?.id === post.user_id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeletePost}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <h3 className="text-xl font-bold mb-2">{sanitizeText(post.title)}</h3>
          
          {post.genre && (
            <Badge variant="secondary" className="mb-3">
              {post.genre}
            </Badge>
          )}

          <p className="text-foreground whitespace-pre-wrap mb-4">{sanitizeText(post.content)}</p>

          {post.book && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted mb-4">
              {post.book.cover_url && (
                <img
                  src={post.book.cover_url}
                  alt={post.book.title}
                  className="w-12 h-16 object-cover rounded"
                />
              )}
              <div>
                <p className="font-medium text-sm">{post.book.title}</p>
                {post.book.author && (
                  <p className="text-xs text-muted-foreground">{post.book.author}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 pt-3 border-t">
            <div className="flex items-center gap-2">
              <HeartLike
                liked={post.user_has_liked}
                onLike={() => onLike(post.id)}
                size={20}
              />
              <span className="text-sm text-muted-foreground">{post.likes_count}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              {post.comments_count}
            </Button>
          </div>

          {showComments && (
            <div className="mt-4 pt-4 border-t space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Write a comment..."
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <Button onClick={handleAddComment} disabled={!commentContent.trim()}>
                  Comment
                </Button>
              </div>

              {comments.length > 0 && (
                <div className="space-y-2">
                  {comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      onReply={handleReply}
                      onDelete={deleteComment}
                      currentUserId={user?.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
    </ContextMenuNative>
  );
};
