import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorStatus } from "@/services/api/client";
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
  const { user } = useAuth();
  const identity = JSON.stringify([user?.id, query, rating, scope, sort]);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const requestId = useRef(0);
  const failedRequest = useRef<{ identity: string; cursor: string | null; append: boolean }>();
  const [loadedIdentity, setLoadedIdentity] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [requestedIdentity, setRequestedIdentity] = useState(identity);
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
      if (currentIdentity.current !== identity) return;
      const request = ++requestId.current;
      const isCurrent = () => requestId.current === request && currentIdentity.current === identity;
      try {
        failedRequest.current = undefined;
        setRequestedIdentity(identity);
        setError(null);
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
        if (!isCurrent()) return;
        applyResponse(response, append);
        setLoadedIdentity(identity);
      } catch (error: unknown) {
        if (!isCurrent()) return;
        failedRequest.current = { identity, cursor, append };
        if ([401, 403, 404].includes(getApiErrorStatus(error) ?? 0)) {
          setLoadedIdentity(undefined);
          setReviews([]);
        }
        setError("Reviews could not load. Check your connection and try again.");
        console.error("Error loading review feed:", error);
        toast.error("Failed to load reviews");
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [applyResponse, query, rating, scope, sort, identity]
  );

  useEffect(() => {
    void fetchReviews();
    return () => { requestId.current += 1; };
  }, [fetchReviews]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && loadedIdentity === identity && hasMore && nextCursor) {
      void fetchReviews(nextCursor, true);
    }
  }, [fetchReviews, hasMore, loading, loadingMore, loadedIdentity, identity, nextCursor]);

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
      if (currentIdentity.current !== identity) return;
      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId
            ? { ...review, user_has_liked: result.liked, likes_count: result.likes_count }
            : review
        )
      );
    } catch (error: unknown) {
      if (currentIdentity.current !== identity) return;
      console.error("Error toggling review like:", error);
      toast.error("Failed to update like");
      setReviews((current) =>
        current.map((review) => (review.id === reviewId ? original : review))
      );
    }
  }, [reviews, identity]);

  const deleteReview = useCallback(async (reviewId: string) => {
    const original = reviews.find((review) => review.id === reviewId);
    if (!original) return;

    setReviews((current) => current.filter((review) => review.id !== reviewId));

    try {
      await deleteBookReview(reviewId);
      if (currentIdentity.current !== identity) return;
      toast.success("Review deleted");
    } catch (error: unknown) {
      if (currentIdentity.current !== identity) return;
      console.error("Error deleting review:", error);
      toast.error("Failed to delete review");
      setReviews((current) => [original, ...current]);
    }
  }, [reviews, identity]);

  const shareReviewById = useCallback(async (reviewId: string) => {
    try {
      const result = await shareReview(reviewId);
      if (currentIdentity.current !== identity) return;
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
        if (currentIdentity.current !== identity) return;
        toast.success("Review link copied");
      }

      if (currentIdentity.current !== identity) return;
      setReviews((current) =>
        current.map((item) =>
          item.id === reviewId ? { ...item, share_count: result.share_count } : item
        )
      );
    } catch (error: unknown) {
      if (currentIdentity.current !== identity) return;
      if (error instanceof Error && error.message.toLowerCase().includes("cancel")) return;
      console.error("Error sharing review:", error);
      toast.error("Failed to share review");
    }
  }, [reviews, identity]);

  return {
    reviews: loadedIdentity === identity ? reviews : [],
    summary: loadedIdentity === identity ? summary : EMPTY_SUMMARY,
    loading: loadedIdentity !== identity && (loading || requestedIdentity !== identity),
    refreshing: loadedIdentity === identity && loading,
    hasLoaded: loadedIdentity === identity,
    error: requestedIdentity === identity ? error : null,
    loadingMore,
    hasMore: loadedIdentity === identity && hasMore,
    caughtUp: loadedIdentity === identity && caughtUp,
    refetch: () => fetchReviews(),
    retry: () => {
      const failed = failedRequest.current;
      return failed?.identity === identity
        ? fetchReviews(failed.cursor, failed.append)
        : fetchReviews();
    },
    loadMore,
    toggleLike,
    deleteReview,
    shareReview: shareReviewById,
  };
};
