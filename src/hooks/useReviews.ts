import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeInput } from "@/utils/sanitize";

interface Review {
  id: string;
  user_id: string;
  book_id: string;
  rating: number;
  title: string | null;
  content: string;
  is_spoiler: boolean;
  is_public: boolean;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ReviewComment {
  id: string;
  review_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface CreateReviewData {
  book_id: string;
  rating: number;
  title?: string;
  content: string;
  is_spoiler?: boolean;
  is_public?: boolean;
}

export const useReviews = (bookId?: string, reviewId?: string) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchReviews = async () => {
    if (!bookId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("book_reviews")
        .select(`
          *,
          profiles (
            display_name,
            avatar_url
          )
        `)
        .eq("book_id", bookId)
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setReviews(data || []);

      // Calculate average rating
      if (data && data.length > 0) {
        const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
        setAverageRating(Math.round(avg * 10) / 10);
      }

      // Check if current user has reviewed
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (currentUser) {
        const hasReview = data?.some((r) => r.user_id === currentUser.id);
        setUserHasReviewed(!!hasReview);
      }
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
  };

  const fetchSingleReview = async () => {
    if (!reviewId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("book_reviews")
        .select(`
          *,
          profiles (
            display_name,
            avatar_url
          )
        `)
        .eq("id", reviewId)
        .single();

      if (error) throw error;

      setReview(data);
    } catch (error: unknown) {
      console.error("Error fetching review:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!reviewId) return;

    try {
      const { data, error } = await supabase
        .from("review_comments")
        .select(`
          *,
          profiles (
            display_name,
            avatar_url
          )
        `)
        .eq("review_id", reviewId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setComments(data || []);
    } catch (error: unknown) {
      console.error("Error fetching comments:", error);
    }
  };

  useEffect(() => {
    if (bookId) {
      fetchReviews();
    }
    if (reviewId) {
      fetchSingleReview();
      fetchComments();
    }
  }, [bookId, reviewId]);

  const createReview = async (data: CreateReviewData) => {
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error("Not authenticated");

      const { error } = await supabase.from("book_reviews").insert({
        user_id: currentUser.id,
        ...data,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Review created successfully",
      });

      fetchReviews();
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
  };

  const updateReview = async (reviewId: string, data: Partial<CreateReviewData>) => {
    try {
      const { error } = await supabase
        .from("book_reviews")
        .update(data)
        .eq("id", reviewId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Review updated successfully",
      });

      fetchReviews();
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
  };

  const deleteReview = async (reviewId: string) => {
    try {
      const { error } = await supabase
        .from("book_reviews")
        .delete()
        .eq("id", reviewId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Review deleted successfully",
      });

      fetchReviews();
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
  };

  const likeReview = async (reviewId: string) => {
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error("Not authenticated");

      const { error } = await supabase.from("review_likes").insert({
        review_id: reviewId,
        user_id: currentUser.id,
      });

      if (error) throw error;

      fetchReviews();
    } catch (error: unknown) {
      console.error("Error liking review:", error);
      toast({
        title: "Error",
        description: "Failed to like review",
        variant: "destructive",
      });
    }
  };

  const unlikeReview = async (reviewId: string) => {
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("review_likes")
        .delete()
        .eq("review_id", reviewId)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      fetchReviews();
    } catch (error: unknown) {
      console.error("Error unliking review:", error);
      toast({
        title: "Error",
        description: "Failed to unlike review",
        variant: "destructive",
      });
    }
  };

  const checkUserLiked = async (reviewId: string) => {
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) return false;

      const { data } = await supabase
        .from("review_likes")
        .select("id")
        .eq("review_id", reviewId)
        .eq("user_id", currentUser.id)
        .maybeSingle();

      return !!data;
    } catch (error) {
      return false;
    }
  };

  const addComment = async (reviewId: string, content: string) => {
    try {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) throw new Error("Not authenticated");

      const sanitizedContent = sanitizeInput(content);

      const { error } = await supabase.from("review_comments").insert({
        review_id: reviewId,
        user_id: currentUser.id,
        content: sanitizedContent,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Comment added successfully",
      });

      fetchComments();
    } catch (error: unknown) {
      console.error("Error adding comment:", error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("review_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });

      fetchComments();
    } catch (error: unknown) {
      console.error("Error deleting comment:", error);
      toast({
        title: "Error",
        description: "Failed to delete comment",
        variant: "destructive",
      });
    }
  };

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
