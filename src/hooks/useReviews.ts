import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  addReviewComment,
  checkBookReviewLiked,
  createBookReview,
  deleteBookReview,
  deleteReviewComment,
  fetchBookReviews,
  fetchCommunityReviews,
  fetchReviewComments,
  fetchSingleReview,
  likeBookReview,
  unlikeBookReview,
  updateBookReview,
  type CreateReviewData,
  type Review,
  type ReviewComment,
} from "@/services/api";

interface UseReviewsOptions {
  autoFetch?: boolean;
  community?: boolean;
  limit?: number;
}

export const useReviews = (
  bookId?: string,
  reviewId?: string,
  options: UseReviewsOptions = {}
) => {
  const shouldAutoFetch = options.autoFetch ?? Boolean(bookId || reviewId || options.community);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(shouldAutoFetch);
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchReviews = useCallback(async () => {
    if (!bookId && !options.community) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const data = options.community
        ? await fetchCommunityReviews(options.limit)
        : await fetchBookReviews(bookId as string);
      setReviews(data.reviews);
      setAverageRating(data.averageRating);
      setUserHasReviewed(data.userHasReviewed);
    } catch (error: unknown) {
      console.error("Error fetching reviews:", error);
      toast({
        title: "Error",
        description: "Failed to load reviews",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [bookId, options.community, options.limit, toast]);

  const fetchSingleReviewById = useCallback(async () => {
    if (!reviewId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      setReview(await fetchSingleReview(reviewId));
    } catch (error: unknown) {
      console.error("Error fetching review:", error);
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  const fetchComments = useCallback(async () => {
    if (!reviewId) return;

    try {
      setComments(await fetchReviewComments(reviewId));
    } catch (error: unknown) {
      console.error("Error fetching comments:", error);
    }
  }, [reviewId]);

  useEffect(() => {
    if (!shouldAutoFetch) {
      setLoading(false);
      return;
    }

    if (bookId || options.community) {
      void fetchReviews();
    }
    if (reviewId) {
      void fetchSingleReviewById();
      void fetchComments();
    }
  }, [
    bookId,
    fetchComments,
    fetchReviews,
    fetchSingleReviewById,
    options.community,
    reviewId,
    shouldAutoFetch,
  ]);

  const createReview = useCallback(async (data: CreateReviewData) => {
    try {
      await createBookReview(data);

      toast({
        title: "Success",
        description: "Review created successfully",
      });

      void fetchReviews();
      return { success: true };
    } catch (error: unknown) {
      console.error("Error creating review:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create review",
        variant: "destructive",
      });
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }, [fetchReviews, toast]);

  const updateReview = useCallback(async (reviewId: string, data: Partial<CreateReviewData>) => {
    try {
      await updateBookReview(reviewId, data);

      toast({
        title: "Success",
        description: "Review updated successfully",
      });

      void fetchReviews();
      return { success: true };
    } catch (error: unknown) {
      console.error("Error updating review:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update review",
        variant: "destructive",
      });
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }, [fetchReviews, toast]);

  const deleteReview = useCallback(async (reviewId: string) => {
    try {
      await deleteBookReview(reviewId);

      toast({
        title: "Success",
        description: "Review deleted successfully",
      });

      void fetchReviews();
      return { success: true };
    } catch (error: unknown) {
      console.error("Error deleting review:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete review",
        variant: "destructive",
      });
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }, [fetchReviews, toast]);

  const likeReview = useCallback(async (reviewId: string) => {
    try {
      await likeBookReview(reviewId);

      void fetchReviews();
    } catch (error: unknown) {
      console.error("Error liking review:", error);
      toast({
        title: "Error",
        description: "Failed to like review",
        variant: "destructive",
      });
    }
  }, [fetchReviews, toast]);

  const unlikeReview = useCallback(async (reviewId: string) => {
    try {
      await unlikeBookReview(reviewId);

      void fetchReviews();
    } catch (error: unknown) {
      console.error("Error unliking review:", error);
      toast({
        title: "Error",
        description: "Failed to unlike review",
        variant: "destructive",
      });
    }
  }, [fetchReviews, toast]);

  const checkUserLiked = useCallback(async (reviewId: string) => {
    try {
      return await checkBookReviewLiked(reviewId);
    } catch (error) {
      return false;
    }
  }, []);

  const addComment = useCallback(async (reviewId: string, content: string) => {
    try {
      await addReviewComment(reviewId, content);

      toast({
        title: "Success",
        description: "Comment added successfully",
      });

      void fetchComments();
    } catch (error: unknown) {
      console.error("Error adding comment:", error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    }
  }, [fetchComments, toast]);

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      await deleteReviewComment(commentId);

      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });

      void fetchComments();
    } catch (error: unknown) {
      console.error("Error deleting comment:", error);
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    }
  }, [fetchComments, toast]);

  return {
    reviews,
    review,
    comments,
    loading,
    userHasReviewed,
    averageRating,
    createReview,
    updateReview,
    deleteReview,
    likeReview,
    unlikeReview,
    checkUserLiked,
    addComment,
    deleteComment,
    refetch: fetchReviews,
  };
};
