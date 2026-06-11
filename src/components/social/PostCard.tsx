import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActionSheet } from "@/components/ui/action-sheet";
import { HeartLike } from "@/components/animations/HeartLike";
import { CommentThread } from "./CommentThread";
import { AppIcon } from "@/components/ui/app-icon";
import type { Post } from "@/hooks/usePosts";
import { useAuth } from "@/hooks/useAuth";
import { blockUser, deletePost, sharePost } from "@/services/api";
import { APP_ICONS } from "@/config/iconography";
import { cn } from "@/lib/utils";
import { sanitizeText } from "@/utils/sanitize";
import { toast } from "sonner";

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onBlocked?: (userId: string) => void;
  compact?: boolean;
}

const initials = (name?: string | null) =>
  (name || "Reader")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 1) return "Just now";
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInHours < 168) {
    return date.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

export const PostCard = ({ post, onLike, onDelete, onBlocked, compact }: PostCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [shareCount, setShareCount] = useState(post.share_count || 0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwner = user?.id === post.user_id;
  const postType = post.post_type || "text";
  const visibility = post.visibility || "public";

  const openProfile = () => navigate(`/users/${post.user_id}`);

  const handleDeletePost = async () => {
    try {
      await deletePost(post.id);
      toast.success("Post removed");
      onDelete?.(post.id);
    } catch (error: unknown) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    }
  };

  const handleShare = async () => {
    try {
      const result = await sharePost(post.id, "native");
      setShareCount(result.share_count);
      const url = result.share_url || post.share_url || `${window.location.origin}/posts/${post.id}`;
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.content,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Post link copied");
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Error sharing post:", error);
      toast.error("Failed to share post");
    }
  };

  const handleBlock = async () => {
    if (isOwner) return;
    const ok = window.confirm(
      `Block ${post.user?.display_name || "this reader"}? You will no longer see each other's posts, profiles, or activity.`
    );
    if (!ok) return;

    try {
      await blockUser(post.user_id);
      toast.success("Reader blocked");
      onBlocked?.(post.user_id);
    } catch (error: unknown) {
      console.error("Error blocking user:", error);
      toast.error("Failed to block user");
    }
  };

  const actions = [
    {
      label: "Share",
      icon: <AppIcon icon={APP_ICONS.common.share} variant="inline" size="md" />,
      onClick: handleShare,
    },
    ...(isOwner
      ? [
          {
            label: "Delete Post",
            icon: <AppIcon icon={APP_ICONS.common.delete} variant="inline" size="md" />,
            variant: "destructive" as const,
            onClick: handleDeletePost,
          },
        ]
      : [
          {
            label: "Report",
            icon: <AppIcon icon={APP_ICONS.common.warning} variant="inline" size="md" />,
            variant: "destructive" as const,
            onClick: () => toast.success("Post reported. Thank you for keeping Brack safe."),
          },
          {
            label: "Block Reader",
            icon: <AppIcon icon={APP_ICONS.common.warning} variant="inline" size="md" />,
            variant: "destructive" as const,
            onClick: handleBlock,
          },
        ]),
  ];

  return (
    <>
      <Card className="overflow-hidden border-border/70 bg-card/95 transition-colors hover:border-primary/35">
        <article className={cn("space-y-4 p-4 sm:p-5", compact && "p-4")}>
          <header className="flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={openProfile}
              className="flex min-w-0 items-center gap-3 text-left"
            >
              <Avatar className="h-11 w-11 shrink-0 border border-border/70">
                <AvatarImage src={post.user?.avatar_url || undefined} />
                <AvatarFallback>{initials(post.user?.display_name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate font-sans text-sm font-semibold">
                  {post.user?.display_name || "Unknown reader"}
                </span>
                <span className="block font-sans text-xs text-muted-foreground">
                  {formatDate(post.created_at)}
                </span>
              </span>
            </button>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:inline-flex">
                {postType === "book"
                  ? "Book"
                  : postType === "club"
                    ? "Club"
                    : "Post"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Post options"
                onClick={() => setActionsOpen(true)}
              >
                <AppIcon icon={APP_ICONS.common.more} variant="action" />
              </Button>
            </div>
          </header>

          <div className="space-y-3">
            <div className="space-y-2">
              <h2 className="font-display text-xl font-semibold leading-tight">
                {sanitizeText(post.title)}
              </h2>
              <div className="flex flex-wrap gap-2">
                {post.genre && <Badge variant="secondary">{post.genre}</Badge>}
                {visibility !== "public" && (
                  <Badge variant="outline">{visibility}</Badge>
                )}
              </div>
            </div>

            <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-foreground sm:text-base">
              {sanitizeText(post.content)}
            </p>
          </div>

          {post.media && post.media.length > 0 && <PostMediaGrid post={post} />}

          {(post.book || post.club) && <PostAttachment post={post} />}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-2 rounded-full border border-border/70 px-3 py-2">
                <HeartLike liked={post.user_has_liked} onLike={() => onLike(post.id)} size={20} />
                <span className="font-sans text-sm text-muted-foreground">
                  {post.likes_count || 0}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComments((value) => !value)}
                className="gap-2 rounded-full"
              >
                <AppIcon icon={APP_ICONS.common.chat} variant="inline" size="sm" />
                {post.comments_count || 0}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="gap-2 rounded-full"
              >
                <AppIcon icon={APP_ICONS.common.share} variant="inline" size="sm" />
                {shareCount}
              </Button>
            </div>
          </footer>

          {showComments && (
            <div className="border-t border-border/70 pt-4">
              <CommentThread postId={post.id} />
            </div>
          )}
        </article>
      </Card>
      <ActionSheet
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        title="Post Options"
        description="Choose an action"
        actions={actions}
      />
    </>
  );
};

const PostMediaGrid = ({ post }: { post: Post }) => {
  const media = post.media || [];
  return (
    <div
      className={cn(
        "grid gap-2 overflow-hidden rounded-md border border-border/70 bg-muted/20 p-2",
        media.length === 1 ? "grid-cols-1" : "grid-cols-2"
      )}
    >
      {media.map((item) => (
        <div
          key={item.id || item.storage_path}
          className="relative aspect-[4/3] overflow-hidden rounded bg-muted"
        >
          {item.media_type === "video" ? (
            <video
              src={item.signed_url || undefined}
              poster={item.thumbnail_url || undefined}
              controls
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={item.signed_url || undefined}
              alt={post.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
        </div>
      ))}
    </div>
  );
};

const PostAttachment = ({ post }: { post: Post }) => {
  const navigate = useNavigate();
  if (post.book) {
    return (
      <button
        type="button"
        onClick={() => navigate(`/book/${post.book_id}`)}
        className="flex w-full items-center gap-3 rounded-md border border-border/70 bg-muted/25 p-3 text-left transition-colors hover:border-primary/40"
      >
        {post.book.cover_url ? (
          <img
            src={post.book.cover_url}
            alt={post.book.title}
            className="h-16 w-11 rounded object-cover"
          />
        ) : (
          <div className="flex h-16 w-11 items-center justify-center rounded bg-muted/50 text-muted-foreground">
            <AppIcon icon={APP_ICONS.dashboard.coverFallback} variant="empty" size="md" />
          </div>
        )}
        <span className="min-w-0">
          <span className="block truncate font-display text-base font-semibold">
            {post.book.title}
          </span>
          {post.book.author && (
            <span className="block truncate font-serif text-sm text-muted-foreground">
              {post.book.author}
            </span>
          )}
        </span>
      </button>
    );
  }

  if (post.club) {
    return (
      <button
        type="button"
        onClick={() => navigate(`/clubs/${post.club_id}`)}
        className="flex w-full items-center gap-3 rounded-md border border-border/70 bg-muted/25 p-3 text-left transition-colors hover:border-primary/40"
      >
        <AppIcon icon={APP_ICONS.nav.clubs} variant="inline" size="md" className="shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block truncate font-display text-base font-semibold">
            {post.club.name}
          </span>
          {post.club.description && (
            <span className="block truncate font-sans text-sm text-muted-foreground">
              {post.club.description}
            </span>
          )}
        </span>
      </button>
    );
  }

  return null;
};
