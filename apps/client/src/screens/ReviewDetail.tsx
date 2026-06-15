import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ChatBubble, Heart, ShareIos, Star, Trash } from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { NativeHeader } from "@/components/NativeHeader";
import { PremiumEmptyState } from "@/components/empty/PremiumEmptyState";
import { RichTextRenderer } from "@/components/rich-text/RichTextRenderer";
import { ReviewCard } from "@/components/social/ReviewCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  addReviewComment,
  deleteBookReview,
  deleteReviewComment,
  fetchReviewComments,
  fetchReviewDetail,
  shareReview as shareReviewApi,
  toggleBookReviewLike,
  type Review,
  type ReviewComment,
} from "@/services/api";
import { sanitizeText } from "@/utils/sanitize";
import { toast } from "sonner";

const getInitials = (name: string | null | undefined) => {
  if (!name) return "R";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const ReviewDetail = () => {
  const { reviewId } = useParams<{ reviewId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const confirm = useConfirmDialog();
  const [review, setReview] = useState<Review | null>(null);
  const [relatedReviews, setRelatedReviews] = useState<Review[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [commentCursor, setCommentCursor] = useState<string | null>(null);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const loadReview = useCallback(async () => {
    if (!reviewId) return;

    try {
      setLoading(true);
      const detail = await fetchReviewDetail(reviewId);
      setReview(detail.review);
      setRelatedReviews(detail.related_reviews);
    } catch (error) {
      console.error("Failed to load review", error);
      toast.error("Failed to load review");
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  const loadComments = useCallback(
    async (cursor: string | null = null, append = false) => {
      if (!reviewId) return;

      try {
        setCommentsLoading(true);
        const page = await fetchReviewComments(reviewId, cursor, 20);
        setComments((current) => (append ? [...current, ...page.comments] : page.comments));
        setCommentCursor(page.next_cursor ?? null);
        setCommentsHasMore(page.has_more);
      } catch (error) {
        console.error("Failed to load review comments", error);
        toast.error("Failed to load comments");
      } finally {
        setCommentsLoading(false);
      }
    },
    [reviewId]
  );

  useEffect(() => {
    void loadReview();
    void loadComments();
  }, [loadComments, loadReview]);

  const reviewer = review?.reviewer ?? review?.profiles;
  const book = review?.book ?? review?.books;
  const isOwnReview = Boolean(user?.id && review?.user_id === user.id);
  const createdLabel = useMemo(
    () =>
      review?.created_at
        ? formatDistanceToNow(new Date(review.created_at), { addSuffix: true })
        : "",
    [review?.created_at]
  );

  const handleToggleLike = async () => {
    if (!review) return;
    const previous = review;
    const liked = Boolean(review.user_has_liked);

    setReview({
      ...review,
      user_has_liked: !liked,
      likes_count: Math.max(0, (review.likes_count || 0) + (liked ? -1 : 1)),
    });

    try {
      const result = await toggleBookReviewLike(review.id);
      setReview((current) =>
        current
          ? { ...current, user_has_liked: result.liked, likes_count: result.likes_count }
          : current
      );
    } catch (error) {
      console.error("Failed to update review like", error);
      setReview(previous);
      toast.error("Failed to update like");
    }
  };

  const handleShare = async () => {
    if (!review) return;

    try {
      const result = await shareReviewApi(review.id);
      const shareData = {
        title: book?.title ? `Review: ${book.title}` : "Brack review",
        text: review.title || review.content.slice(0, 140),
        url: result.share_url,
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(result.share_url);
        toast.success("Review link copied");
      }

      setReview((current) =>
        current ? { ...current, share_count: result.share_count } : current
      );
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("cancel")) return;
      console.error("Failed to share review", error);
      toast.error("Failed to share review");
    }
  };

  const handleDeleteReview = async () => {
    if (!review) return;

    const ok = await confirm({
      title: "Delete review?",
      description: "This removes the review from the public reviews feed and the book page.",
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      await deleteBookReview(review.id);
      toast.success("Review deleted");
      navigate("/reviews");
    } catch (error) {
      console.error("Failed to delete review", error);
      toast.error("Failed to delete review");
    }
  };

  const handleSubmitComment = async () => {
    if (!review || !commentDraft.trim()) return;

    try {
      setSubmittingComment(true);
      const comment = await addReviewComment(review.id, commentDraft.trim());
      setComments((current) => [...current, comment]);
      setReview((current) =>
        current ? { ...current, comments_count: (current.comments_count || 0) + 1 } : current
      );
      setCommentDraft("");
    } catch (error) {
      console.error("Failed to add review comment", error);
      toast.error("Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const ok = await confirm({
      title: "Delete comment?",
      description: "This removes your comment from the review thread.",
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      await deleteReviewComment(commentId);
      setComments((current) => current.filter((comment) => comment.id !== commentId));
      setReview((current) =>
        current
          ? { ...current, comments_count: Math.max(0, (current.comments_count || 0) - 1) }
          : current
      );
    } catch (error) {
      console.error("Failed to delete review comment", error);
      toast.error("Failed to delete comment");
    }
  };

  return (
    <MobileLayout>
      {isMobile ? (
        <MobileHeader title="Review" back={{ fallbackPath: "/reviews" }} />
      ) : (
        <NativeHeader
          title="Review"
          subtitle={book?.title ? `A reader's take on ${book.title}` : "Shared book reaction"}
          back={{ fallbackPath: "/reviews", label: "Reviews" }}
          showUtilityActions
        />
      )}

      <main className="app-page">
        {loading ? (
          <ReviewDetailSkeleton />
        ) : review && book ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="min-w-0 space-y-5">
              <Card>
                <CardContent className="grid gap-5 p-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:p-5">
                  <div className="mx-auto h-48 w-32 overflow-hidden rounded-md border border-border/70 bg-muted sm:mx-0">
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-3 text-center font-sans text-xs text-muted-foreground">
                        No cover
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">Book reviewed</Badge>
                        {review.is_spoiler && <Badge variant="outline">Spoiler marked</Badge>}
                      </div>
                      <h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">
                        {sanitizeText(book.title)}
                      </h1>
                      {book.author && (
                        <p className="mt-2 font-serif text-lg text-muted-foreground">
                          by {sanitizeText(book.author)}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 font-sans text-sm text-muted-foreground">
                        {book.genre && <span>{sanitizeText(book.genre)}</span>}
                        {book.pages ? <span>{book.pages} pages</span> : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          navigate(
                            review.viewer_book_id
                              ? `/book/${review.viewer_book_id}`
                              : `/add-book?query=${encodeURIComponent(
                                  [book.title, book.author].filter(Boolean).join(" ")
                                )}`
                          )
                        }
                      >
                        {review.viewer_book_id ? "Open my copy" : "Add or find this book"}
                      </Button>
                      <Button variant="outline" onClick={handleShare}>
                        <ShareIos className="mr-2 h-4 w-4" />
                        Share review
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-5 p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        className="h-11 w-11 cursor-pointer"
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
                          onClick={() => navigate(`/users/${review.user_id}`)}
                          className="block max-w-full truncate text-left font-sans font-semibold hover:underline"
                        >
                          {reviewer?.display_name || "Anonymous reader"}
                        </button>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StarRating rating={review.rating} />
                          <span className="font-sans text-xs text-muted-foreground">
                            {createdLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isOwnReview && (
                      <Button variant="outline" size="sm" onClick={handleDeleteReview}>
                        <Trash className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {review.title && (
                      <h2 className="font-display text-2xl font-semibold">
                        {sanitizeText(review.title)}
                      </h2>
                    )}
                    <RichTextRenderer
                      content={review.content}
                      contentFormat={review.content_format}
                      contentJson={review.content_json}
                      contentHtml={review.content_html}
                      className="font-serif text-lg leading-8 text-foreground"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleToggleLike}
                      className={cn(review.user_has_liked && "text-primary")}
                    >
                      <Heart
                        className={cn("mr-2 h-4 w-4", review.user_has_liked && "fill-primary")}
                      />
                      {review.likes_count ?? 0}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => document.getElementById("review-comments")?.scrollIntoView({ behavior: "smooth" })}>
                      <ChatBubble className="mr-2 h-4 w-4" />
                      {review.comments_count ?? 0}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleShare}>
                      <ShareIos className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card id="review-comments">
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Comments</h2>
                    <p className="font-sans text-sm text-muted-foreground">
                      Keep discussion tied to this review without loading entire threads in the feed.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      placeholder="Add a thoughtful reply..."
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={handleSubmitComment}
                        disabled={submittingComment || !commentDraft.trim()}
                      >
                        {submittingComment ? "Posting..." : "Post comment"}
                      </Button>
                    </div>
                  </div>

                  {comments.length === 0 ? (
                    <PremiumEmptyState
                      asset="emptyComments"
                      title="No comments yet"
                      description="Start the conversation around this review."
                      size="compact"
                      variant="plain"
                    />
                  ) : (
                    <div className="space-y-3">
                      {comments.map((comment) => (
                        <ReviewCommentItem
                          key={comment.id}
                          comment={comment}
                          canDelete={comment.user_id === user?.id}
                          onDelete={() => handleDeleteComment(comment.id)}
                        />
                      ))}
                    </div>
                  )}

                  {commentsHasMore && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={() => loadComments(commentCursor, true)}
                        disabled={commentsLoading}
                      >
                        {commentsLoading ? "Loading..." : "Load more comments"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {relatedReviews.length > 0 && (
                <section className="space-y-3">
                  <h2 className="font-display text-xl font-semibold">More reviews for this book</h2>
                  <div className="space-y-4">
                    {relatedReviews.map((related) => (
                      <ReviewCard key={related.id} review={related} compact />
                    ))}
                  </div>
                </section>
              )}
            </section>

            <aside className="hidden space-y-4 xl:block">
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Review context</h2>
                    <p className="font-sans text-sm text-muted-foreground">
                      Public review pages stay independent from private library copies.
                    </p>
                  </div>
                  <div className="space-y-3 text-sm">
                    <DetailFact label="Rating" value={`${review.rating}/5`} />
                    <DetailFact label="Visibility" value={review.is_public ? "Public" : "Private"} />
                    <DetailFact label="Likes" value={String(review.likes_count ?? 0)} />
                    <DetailFact label="Shares" value={String(review.share_count ?? 0)} />
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        ) : (
          <PremiumEmptyState
            asset="emptyReviews"
            title="Review unavailable"
            description="This review may have been deleted, made private, or hidden by privacy settings."
            action={<Button onClick={() => navigate("/reviews")}>Back to Reviews</Button>}
          />
        )}
      </main>
    </MobileLayout>
  );
};

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center" aria-label={`${rating} star rating`}>
    {Array.from({ length: 5 }).map((_, index) => (
      <Star
        key={index}
        className={cn(
          "h-4 w-4",
          index < rating ? "fill-primary text-primary" : "text-muted-foreground/40"
        )}
      />
    ))}
  </div>
);

const DetailFact = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0 last:pb-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const ReviewCommentItem = ({
  comment,
  canDelete,
  onDelete,
}: {
  comment: ReviewComment;
  canDelete: boolean;
  onDelete: () => void;
}) => (
  <div className="rounded-md border border-border/70 p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage
            src={comment.profiles?.avatar_url || undefined}
            alt={comment.profiles?.display_name || "Reader"}
          />
          <AvatarFallback>{getInitials(comment.profiles?.display_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-sans text-sm font-semibold">
              {comment.profiles?.display_name || "Anonymous reader"}
            </p>
            <span className="font-sans text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap font-serif text-sm leading-6">
            {sanitizeText(comment.content)}
          </p>
        </div>
      </div>
      {canDelete && (
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete comment">
          <Trash className="h-4 w-4" />
        </Button>
      )}
    </div>
  </div>
);

const ReviewDetailSkeleton = () => (
  <div className="space-y-5">
    <Card>
      <CardContent className="grid gap-5 p-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:p-5">
        <Skeleton className="h-48 w-32 rounded-md" />
        <div className="space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-10 w-40" />
        </div>
      </CardContent>
    </Card>
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-32 w-full" />
      </CardContent>
    </Card>
  </div>
);

export default ReviewDetail;
