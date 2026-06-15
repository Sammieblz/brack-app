import { supabase } from "@/integrations/supabase/client";
import { sanitizeInput } from "@/utils/sanitize";
import { getCurrentAuthUser } from "./auth";
import { invokeFunction } from "./client";
import type { RichTextDocument, RichTextFormat } from "@/types/richText";

export type ReviewScope = "for_you" | "following" | "recent" | "popular" | "mine";
export type ReviewSort = "personalized" | "recent" | "popular";
export type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";

export interface ReviewBookSummary {
  id: string;
  user_id?: string | null;
  title: string;
  author: string | null;
  cover_url: string | null;
  isbn?: string | null;
  genre?: string | null;
  pages?: number | null;
  description?: string | null;
}

export interface ReviewUserSummary {
  id?: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Review {
  id: string;
  user_id: string;
  book_id: string;
  rating: number;
  title: string | null;
  content: string;
  content_format?: RichTextFormat | null;
  content_json?: RichTextDocument | null;
  content_html?: string | null;
  is_spoiler: boolean;
  is_public: boolean;
  likes_count: number;
  comments_count: number;
  share_count?: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  profiles: ReviewUserSummary;
  reviewer?: ReviewUserSummary | null;
  books?: ReviewBookSummary | null;
  book?: ReviewBookSummary | null;
  user_has_liked?: boolean;
  viewer_has_book?: boolean;
  viewer_book_id?: string | null;
  feed_reason?: string | null;
  share_url?: string | null;
}

export type ReviewFeedItem = Review;

export interface ReviewComment {
  id: string;
  review_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  profiles: ReviewUserSummary;
}

export interface CreateReviewRequest {
  book_id: string;
  rating: number;
  title?: string;
  content: string;
  content_format?: RichTextFormat;
  content_json?: RichTextDocument | null;
  content_html?: string | null;
  is_spoiler?: boolean;
  is_public?: boolean;
}

export type CreateReviewData = CreateReviewRequest;

export interface ReviewFeedSummary {
  rating_mix: Array<{ rating: number; count: number }>;
  trending_books: Array<{
    id: string;
    title: string;
    author: string | null;
    cover_url: string | null;
    review_count: number;
    average_rating: number | null;
  }>;
  review_opportunities: Array<{
    id: string;
    title: string;
    author: string | null;
    cover_url: string | null;
    date_finished?: string | null;
  }>;
}

export interface ReviewsFeedResponse {
  items: ReviewFeedItem[];
  next_cursor?: string | null;
  has_more: boolean;
  caught_up: boolean;
  feed_mode: ReviewScope;
  summary: ReviewFeedSummary;
}

export interface ReviewsFeedRequest {
  cursor?: string | null;
  limit?: number;
  query?: string;
  rating?: RatingFilter;
  scope?: ReviewScope;
  sort?: ReviewSort;
}

export interface ReviewsResult {
  reviews: Review[];
  averageRating: number | null;
  userHasReviewed: boolean;
}

export interface ReviewDetail {
  review: ReviewFeedItem;
  related_reviews: ReviewFeedItem[];
}

export interface ReviewCommentPage {
  comments: ReviewComment[];
  next_cursor?: string | null;
  has_more: boolean;
}

export interface ShareReviewResponse {
  share_url: string;
  share_count: number;
}

const normalizeReview = (review: Review): Review => ({
  ...review,
  profiles: review.profiles ?? review.reviewer ?? { display_name: null, avatar_url: null },
  reviewer: review.reviewer ?? review.profiles ?? null,
  books: review.books ?? review.book ?? null,
  book: review.book ?? review.books ?? null,
  is_public: review.is_public ?? true,
  is_spoiler: review.is_spoiler ?? false,
  likes_count: review.likes_count ?? 0,
  comments_count: review.comments_count ?? 0,
  share_count: review.share_count ?? 0,
});

export const getReviewsFeed = async ({
  cursor,
  limit = 20,
  query,
  rating,
  scope = "for_you",
  sort = "personalized",
}: ReviewsFeedRequest = {}): Promise<ReviewsFeedResponse> => {
  const response = await invokeFunction<ReviewsFeedResponse>("reviews-feed", {
    body: {
      cursor,
      limit,
      query,
      rating: rating === "all" ? null : rating,
      scope,
      sort,
    },
  });

  return {
    ...response,
    items: (response.items || []).map(normalizeReview),
    summary: response.summary ?? {
      rating_mix: [5, 4, 3, 2, 1].map((value) => ({ rating: value, count: 0 })),
      trending_books: [],
      review_opportunities: [],
    },
  };
};

export const fetchReviewDetail = async (reviewId: string): Promise<ReviewDetail> => {
  const response = await invokeFunction<ReviewDetail>("review-detail", {
    body: { review_id: reviewId },
  });

  return {
    review: normalizeReview(response.review),
    related_reviews: (response.related_reviews || []).map(normalizeReview),
  };
};

export const fetchBookReviews = async (bookId: string): Promise<ReviewsResult> => {
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
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const reviews = ((data || []) as unknown as Review[]).map(normalizeReview);
  const averageRating =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10
        ) / 10
      : null;

  const currentUser = await getCurrentAuthUser();
  const userHasReviewed = currentUser
    ? reviews.some((review) => review.user_id === currentUser.id)
    : false;

  return { reviews, averageRating, userHasReviewed };
};

export const fetchCommunityReviews = async (limit = 50): Promise<ReviewsResult> => {
  const response = await getReviewsFeed({ limit, scope: "recent", sort: "recent" });
  const reviews = response.items;
  const averageRating =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10
        ) / 10
      : null;

  const currentUser = await getCurrentAuthUser();
  const userHasReviewed = currentUser
    ? reviews.some((review) => review.user_id === currentUser.id)
    : false;

  return { reviews, averageRating, userHasReviewed };
};

export const fetchSingleReview = async (reviewId: string): Promise<Review> => {
  const { review } = await fetchReviewDetail(reviewId);
  return review;
};

export const fetchReviewComments = async (
  reviewId: string,
  cursor?: string | null,
  limit = 20
): Promise<ReviewCommentPage> => {
  return invokeFunction<ReviewCommentPage>("review-comments", {
    body: { review_id: reviewId, cursor, limit },
  });
};

export const createBookReview = async (data: CreateReviewRequest): Promise<Review> => {
  const response = await invokeFunction<{ review: Review }>("create-review", {
    body: {
      ...data,
      title: data.title ? sanitizeInput(data.title) : undefined,
      content: sanitizeInput(data.content),
      rich_text: {
        content_format: data.content_format,
        content_json: data.content_json,
        content_html: data.content_html,
      },
    },
  });
  return normalizeReview(response.review);
};

export const createReviewRecord = async (data: Record<string, unknown>): Promise<void> => {
  await createBookReview(data as unknown as CreateReviewRequest);
};

export const updateBookReview = async (
  reviewId: string,
  data: Partial<CreateReviewRequest>
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
  await invokeFunction("delete-review", { body: { review_id: reviewId } });
};

export const toggleBookReviewLike = async (
  reviewId: string
): Promise<{ liked: boolean; likes_count: number }> => {
  return invokeFunction("toggle-review-like", { body: { review_id: reviewId } });
};

export const likeBookReview = async (reviewId: string): Promise<void> => {
  const result = await toggleBookReviewLike(reviewId);
  if (!result.liked) {
    await toggleBookReviewLike(reviewId);
  }
};

export const unlikeBookReview = async (reviewId: string): Promise<void> => {
  const result = await toggleBookReviewLike(reviewId);
  if (result.liked) {
    await toggleBookReviewLike(reviewId);
  }
};

export const checkBookReviewLiked = async (reviewId: string): Promise<boolean> => {
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

export const shareReview = async (reviewId: string): Promise<ShareReviewResponse> => {
  return invokeFunction("share-review", { body: { review_id: reviewId } });
};

export const addReviewComment = async (
  reviewId: string,
  content: string
): Promise<ReviewComment> => {
  const response = await invokeFunction<{ comment: ReviewComment }>("create-review-comment", {
    body: { review_id: reviewId, content: sanitizeInput(content) },
  });
  return response.comment;
};

export const deleteReviewComment = async (commentId: string): Promise<void> => {
  const { error } = await supabase
    .from("review_comments")
    .delete()
    .eq("id", commentId);

  if (error) throw error;
};
