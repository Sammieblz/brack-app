import { supabase } from "@/integrations/supabase/client";
import { sanitizeInput } from "@/utils/sanitize";
import { getCurrentAuthUser } from "./auth";

export interface Review {
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
  books?: {
    title: string;
    author: string | null;
    cover_url: string | null;
  } | null;
}

export interface ReviewComment {
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

export interface CreateReviewData {
  book_id: string;
  rating: number;
  title?: string;
  content: string;
  is_spoiler?: boolean;
  is_public?: boolean;
}

export interface ReviewsResult {
  reviews: Review[];
  averageRating: number | null;
  userHasReviewed: boolean;
}

const normalizeReview = (review: Review): Review => ({
  ...review,
  is_public: review.is_public ?? true,
  is_spoiler: review.is_spoiler ?? false,
  likes_count: review.likes_count ?? 0,
  comments_count: review.comments_count ?? 0,
});

export const fetchBookReviews = async (
  bookId: string
): Promise<ReviewsResult> => {
  const { data, error } = await supabase
    .from("book_reviews")
    .select(
      `
      *,
      profiles (
        display_name,
        avatar_url
      )
    `
    )
    .eq("book_id", bookId)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const reviews = ((data || []) as Review[]).map(normalizeReview);
  const averageRating =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((sum, review) => sum + review.rating, 0) /
            reviews.length) *
            10
        ) / 10
      : null;

  const currentUser = await getCurrentAuthUser();
  const userHasReviewed = currentUser
    ? reviews.some((review) => review.user_id === currentUser.id)
    : false;

  return { reviews, averageRating, userHasReviewed };
};

export const fetchCommunityReviews = async (
  limit = 50
): Promise<ReviewsResult> => {
  const { data, error } = await supabase
    .from("book_reviews")
    .select(
      `
      *,
      profiles (
        display_name,
        avatar_url
      ),
      books (
        title,
        author,
        cover_url
      )
    `
    )
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const reviews = ((data || []) as Review[]).map(normalizeReview);
  const averageRating =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((sum, review) => sum + review.rating, 0) /
            reviews.length) *
            10
        ) / 10
      : null;

  const currentUser = await getCurrentAuthUser();
  const userHasReviewed = currentUser
    ? reviews.some((review) => review.user_id === currentUser.id)
    : false;

  return { reviews, averageRating, userHasReviewed };
};

export const fetchSingleReview = async (reviewId: string): Promise<Review> => {
  const { data, error } = await supabase
    .from("book_reviews")
    .select(
      `
      *,
      profiles (
        display_name,
        avatar_url
      )
    `
    )
    .eq("id", reviewId)
    .single();

  if (error) throw error;
  return data as Review;
};

export const fetchReviewComments = async (
  reviewId: string
): Promise<ReviewComment[]> => {
  const { data, error } = await supabase
    .from("review_comments")
    .select(
      `
      *,
      profiles (
        display_name,
        avatar_url
      )
    `
    )
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []) as ReviewComment[];
};

export const createBookReview = async (
  data: CreateReviewData
): Promise<void> => {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) throw new Error("Not authenticated");

  const { error } = await supabase.from("book_reviews").insert({
    user_id: currentUser.id,
    ...data,
    title: data.title ? sanitizeInput(data.title) : undefined,
    content: sanitizeInput(data.content),
  });

  if (error) throw error;
};

export const createReviewRecord = async (
  data: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabase.from("book_reviews").insert(data);

  if (error) throw error;
};

export const updateBookReview = async (
  reviewId: string,
  data: Partial<CreateReviewData>
): Promise<void> => {
  const updates = {
    ...data,
    title: data.title ? sanitizeInput(data.title) : data.title,
    content: data.content ? sanitizeInput(data.content) : data.content,
  };

  const { error } = await supabase
    .from("book_reviews")
    .update(updates)
    .eq("id", reviewId);

  if (error) throw error;
};

export const updateReviewRecord = async (
  reviewId: string,
  updates: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabase
    .from("book_reviews")
    .update(updates)
    .eq("id", reviewId);

  if (error) throw error;
};

export const deleteBookReview = async (reviewId: string): Promise<void> => {
  const { error } = await supabase
    .from("book_reviews")
    .delete()
    .eq("id", reviewId);

  if (error) throw error;
};

export const likeBookReview = async (reviewId: string): Promise<void> => {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) throw new Error("Not authenticated");

  const { error } = await supabase.from("review_likes").insert({
    review_id: reviewId,
    user_id: currentUser.id,
  });

  if (error) throw error;
};

export const unlikeBookReview = async (reviewId: string): Promise<void> => {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("review_likes")
    .delete()
    .eq("review_id", reviewId)
    .eq("user_id", currentUser.id);

  if (error) throw error;
};

export const checkBookReviewLiked = async (
  reviewId: string
): Promise<boolean> => {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) return false;

  const { data } = await supabase
    .from("review_likes")
    .select("id")
    .eq("review_id", reviewId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  return !!data;
};

export const addReviewComment = async (
  reviewId: string,
  content: string
): Promise<void> => {
  const currentUser = await getCurrentAuthUser();
  if (!currentUser) throw new Error("Not authenticated");

  const { error } = await supabase.from("review_comments").insert({
    review_id: reviewId,
    user_id: currentUser.id,
    content: sanitizeInput(content),
  });

  if (error) throw error;
};

export const deleteReviewComment = async (
  commentId: string
): Promise<void> => {
  const { error } = await supabase
    .from("review_comments")
    .delete()
    .eq("id", commentId);

  if (error) throw error;
};
