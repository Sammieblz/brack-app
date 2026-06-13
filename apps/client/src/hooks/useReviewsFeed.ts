import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  deleteBookReview,
  getReviewsFeed,
  shareReview,
  toggleBookReviewLike,
  type RatingFilter,
  type ReviewFeedItem,
  type ReviewFeedSummary,
  type ReviewScope,
  type ReviewSort,
} from "@/services/api";

const PAGE_SIZE = 20;

const EMPTY_SUMMARY: ReviewFeedSummary = {
  rating_mix: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 })),
  trending_books: [],
  review_opportunities: [],
};

interface UseReviewsFeedOptions {
  query: string;
  rating: RatingFilter;
  scope: ReviewScope;
  sort: ReviewSort;
}

export const useReviewsFeed = ({ query, rating, scope, sort }: UseReviewsFeedOptions) => {
  const [reviews, setReviews] = useState<ReviewFeedItem[]>([]);
  const [summary, setSummary] = useState<ReviewFeedSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [caughtUp, setCaughtUp] = useState(false);

  const applyResponse = useCallback(
    (
      response: Awaited<ReturnType<typeof getReviewsFeed>>,
      append: boolean
    ) => {
      setReviews((current) => {
        const combined = append ? [...current, ...response.items] : response.items;
        const seen = new Set<string>();
        return combined.filter((review) => {
          if (seen.has(review.id)) return false;
          seen.add(review.id);
          return true;
        });
      });
      setSummary(response.summary ?? EMPTY_SUMMARY);
      setNextCursor(response.next_cursor ?? null);
      setHasMore(response.has_more);
      setCaughtUp(response.caught_up);
    },
    []
  );

  const fetchReviews = useCallback(
    async (cursor: string | null = null, append = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const response = await getReviewsFeed({
          cursor,
          limit: PAGE_SIZE,
          query,
          rating,
          scope,
          sort,
        });
        applyResponse(response, append);
      } catch (error: unknown) {
        console.error("Error loading review feed:", error);
        toast.error("Failed to load reviews");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [applyResponse, query, rating, scope, sort]
  );

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && nextCursor) {
      void fetchReviews(nextCursor, true);
    }
  }, [fetchReviews, hasMore, loadingMore, nextCursor]);

  const toggleLike = useCallback(async (reviewId: string) => {
    const original = reviews.find((review) => review.id === reviewId);
    if (!original) return;

    setReviews((current) =>
      current.map((review) =>
        review.id === reviewId
          ? {
              ...review,
              user_has_liked: !review.user_has_liked,
              likes_count: Math.max(
                0,
                (review.likes_count || 0) + (review.user_has_liked ? -1 : 1)
              ),
            }
          : review
      )
    );

    try {
      const result = await toggleBookReviewLike(reviewId);
      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId
            ? { ...review, user_has_liked: result.liked, likes_count: result.likes_count }
            : review
        )
      );
    } catch (error: unknown) {
      console.error("Error toggling review like:", error);
      toast.error("Failed to update like");
      setReviews((current) =>
        current.map((review) => (review.id === reviewId ? original : review))
      );
    }
  }, [reviews]);

  const deleteReview = useCallback(async (reviewId: string) => {
    const original = reviews.find((review) => review.id === reviewId);
    if (!original) return;

    setReviews((current) => current.filter((review) => review.id !== reviewId));

    try {
      await deleteBookReview(reviewId);
      toast.success("Review deleted");
    } catch (error: unknown) {
      console.error("Error deleting review:", error);
      toast.error("Failed to delete review");
      setReviews((current) => [original, ...current]);
    }
  }, [reviews]);

  const shareReviewById = useCallback(async (reviewId: string) => {
    try {
      const result = await shareReview(reviewId);
      const review = reviews.find((item) => item.id === reviewId);
      const shareData = {
        title: review?.book?.title ? `Review: ${review.book.title}` : "Brack review",
        text: review?.title || review?.content?.slice(0, 140) || "Read this review on Brack",
        url: result.share_url,
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(result.share_url);
        toast.success("Review link copied");
      }

      setReviews((current) =>
        current.map((item) =>
          item.id === reviewId ? { ...item, share_count: result.share_count } : item
        )
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.message.toLowerCase().includes("cancel")) return;
      console.error("Error sharing review:", error);
      toast.error("Failed to share review");
    }
  }, [reviews]);

  return {
    reviews,
    summary,
    loading,
    loadingMore,
    hasMore,
    caughtUp,
    refetch: () => fetchReviews(),
    loadMore,
    toggleLike,
    deleteReview,
    shareReview: shareReviewById,
  };
};
