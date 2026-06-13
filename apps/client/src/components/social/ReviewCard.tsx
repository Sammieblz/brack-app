import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ChatBubble, Eye, EyeClosed, Heart, MoreHoriz, ShareIos, Star, Trash } from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useReviews } from "@/hooks/useReviews";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
import { cn } from "@/lib/utils";
import { sanitizeText } from "@/utils/sanitize";
import type { Review } from "@/services/api";

interface ReviewCardProps {
  review: Review;
  showBookInfo?: boolean;
  onEdit?: () => void;
  onChanged?: () => void | Promise<void>;
  onLike?: (reviewId: string) => void | Promise<void>;
  onDelete?: (reviewId: string) => void | Promise<void>;
  onShare?: (reviewId: string) => void | Promise<void>;
  compact?: boolean;
}

const getInitials = (name: string | null | undefined) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const ReviewCard = ({
  review,
  showBookInfo = true,
  onEdit,
  onChanged,
  onLike,
  onDelete,
  onShare,
  compact = false,
}: ReviewCardProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirmDialog();
  const { likeReview, unlikeReview, checkUserLiked, deleteReview } = useReviews();
  const [showSpoiler, setShowSpoiler] = useState(false);
  const [isLiked, setIsLiked] = useState(Boolean(review.user_has_liked));

  const reviewer = review.reviewer ?? review.profiles;
  const book = review.book ?? review.books;
  const isOwnReview = user?.id === review.user_id;
  const reviewPath = `/reviews/${review.id}`;
  const bookSearchPath = `/add-book?query=${encodeURIComponent(
    [book?.title, book?.author].filter(Boolean).join(" ")
  )}`;

  useEffect(() => {
    if (typeof review.user_has_liked === "boolean") {
      setIsLiked(review.user_has_liked);
      return;
    }

    const checkLiked = async () => {
      const liked = await checkUserLiked(review.id);
      setIsLiked(liked);
    };
    void checkLiked();
  }, [checkUserLiked, review.id, review.user_has_liked]);

  const createdLabel = useMemo(
    () => formatDistanceToNow(new Date(review.created_at), { addSuffix: true }),
    [review.created_at]
  );

  const handleLike = async () => {
    if (onLike) {
      await onLike(review.id);
      return;
    }

    if (isLiked) {
      await unlikeReview(review.id);
      setIsLiked(false);
    } else {
      await likeReview(review.id);
      setIsLiked(true);
    }
    await onChanged?.();
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete review?",
      description: "This removes the review from public review feeds and the book page.",
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!ok) return;

    if (onDelete) {
      await onDelete(review.id);
      return;
    }

    await deleteReview(review.id);
    await onChanged?.();
  };

  const handleShare = async () => {
    if (onShare) {
      await onShare(review.id);
      return;
    }

    const shareUrl = review.share_url || `${window.location.origin}${reviewPath}`;
    if (navigator.share) {
      await navigator.share({
        title: book?.title ? `Review: ${book.title}` : "Brack review",
        text: review.title || review.content.slice(0, 140),
        url: shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className={cn("p-0", compact && "text-sm")}>
        {showBookInfo && book && (
          <button
            type="button"
            onClick={() => navigate(reviewPath)}
            className="flex w-full gap-3 border-b border-border/70 p-4 text-left transition-colors hover:bg-muted/40"
          >
            <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted">
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  No cover
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="w-fit">
                  {review.feed_reason || "Review"}
                </Badge>
                {review.is_spoiler && (
                  <Badge variant="outline" className="w-fit">
                    Spoiler
                  </Badge>
                )}
              </div>
              <h3 className="mt-2 line-clamp-2 font-display text-xl font-semibold leading-tight">
                {sanitizeText(book.title)}
              </h3>
              {book.author && (
                <p className="mt-1 line-clamp-1 font-serif text-sm text-muted-foreground">
                  by {sanitizeText(book.author)}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 font-sans text-xs text-muted-foreground">
                {book.genre && <span>{sanitizeText(book.genre)}</span>}
                {book.pages ? <span>{book.pages} pages</span> : null}
              </div>
            </div>
          </button>
        )}

        <div className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar
                className="h-10 w-10 cursor-pointer"
                onClick={() => navigate(`/users/${review.user_id}`)}
              >
                <AvatarImage
                  src={reviewer?.avatar_url || undefined}
                  alt={reviewer?.display_name || "Reader"}
                />
                <AvatarFallback>{getInitials(reviewer?.display_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <button
                  type="button"
                  className="block max-w-full truncate text-left font-sans font-semibold hover:underline"
                  onClick={() => navigate(`/users/${review.user_id}`)}
                >
                  {reviewer?.display_name || "Anonymous reader"}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <div className="flex items-center" aria-label={`${review.rating} star rating`}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className={cn(
                          "h-4 w-4",
                          index < review.rating
                            ? "fill-primary text-primary"
                            : "text-muted-foreground/40"
                        )}
                      />
                    ))}
                  </div>
                  <span className="font-sans text-xs text-muted-foreground">{createdLabel}</span>
                </div>
              </div>
            </div>

            {isOwnReview && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Review options">
                    <MoreHoriz className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit && <DropdownMenuItem onClick={onEdit}>Edit review</DropdownMenuItem>}
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash className="mr-2 h-4 w-4" />
                    Delete review
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate(reviewPath)}
            className="block w-full text-left"
          >
            {review.title && (
              <h4 className="font-display text-lg font-semibold leading-tight">
                {sanitizeText(review.title)}
              </h4>
            )}

            {review.is_spoiler && !showSpoiler ? (
              <div className="mt-3 rounded-md border border-border/70 bg-muted/50 p-4 text-center">
                <p className="font-sans text-sm font-medium">This review contains spoilers.</p>
              </div>
            ) : (
              <p className="mt-2 whitespace-pre-wrap font-serif text-foreground">
                {sanitizeText(compact ? review.content.slice(0, 360) : review.content)}
                {compact && review.content.length > 360 ? "..." : ""}
              </p>
            )}
          </button>

          {review.is_spoiler && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSpoiler((value) => !value)}
            >
              {showSpoiler ? <EyeClosed className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showSpoiler ? "Hide spoiler" : "Reveal spoiler"}
            </Button>
          )}

          <div className="flex flex-wrap items-center gap-1 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={cn(isLiked && "text-primary")}
            >
              <Heart className={cn("mr-2 h-4 w-4", isLiked && "fill-primary")} />
              {review.likes_count ?? 0}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate(reviewPath)}>
              <ChatBubble className="mr-2 h-4 w-4" />
              {review.comments_count ?? 0}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <ShareIos className="mr-2 h-4 w-4" />
              Share
            </Button>
            {book && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => navigate(review.viewer_book_id ? `/book/${review.viewer_book_id}` : bookSearchPath)}
              >
                {review.viewer_book_id ? "Open my copy" : "Find this book"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
