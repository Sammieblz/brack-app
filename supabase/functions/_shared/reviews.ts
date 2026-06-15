import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { getBlockedUserIds, getFollowingIds } from "./social.ts";

export type ReviewCursor = {
  sort: "recent" | "popular";
  created_at: string;
  id: string;
  value?: number;
};

export type ReviewScope = "for_you" | "following" | "recent" | "popular" | "mine";
export type ReviewSort = "personalized" | "recent" | "popular";

export const REVIEW_SELECT = `
  id,
  user_id,
  book_id,
  rating,
  title,
  content,
  content_format,
  content_json,
  content_html,
  is_spoiler,
  is_public,
  likes_count,
  comments_count,
  share_count,
  deleted_at,
  created_at,
  updated_at,
  profiles (
    id,
    display_name,
    avatar_url
  ),
  books (
    id,
    user_id,
    title,
    author,
    cover_url,
    isbn,
    genre,
    pages,
    description
  )
`;

export const COMMENT_SELECT = `
  id,
  review_id,
  user_id,
  content,
  created_at,
  updated_at,
  profiles (
    id,
    display_name,
    avatar_url
  )
`;

export const clampLimit = (value: unknown, fallback = 20, max = 30): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
};

export const sanitizeString = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

export const encodeReviewCursor = (cursor: ReviewCursor | null): string | null => {
  if (!cursor) return null;
  return btoa(JSON.stringify(cursor));
};

export const decodeReviewCursor = (value: unknown): ReviewCursor | null => {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(atob(value)) as ReviewCursor;
    if (!parsed.sort || !parsed.created_at || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const applyReviewCursor = <T>(
  query: T,
  cursor: ReviewCursor | null,
  sort: "recent" | "popular"
): T => {
  if (!cursor) return query;

  if (sort === "popular") {
    const value = Number(cursor.value ?? 0);
    return (query as { or: (filter: string) => T }).or(
      `likes_count.lt.${value},and(likes_count.eq.${value},created_at.lt.${cursor.created_at}),and(likes_count.eq.${value},created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }

  return (query as { or: (filter: string) => T }).or(
    `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
  );
};

export const createReviewUrl = (reviewId: string, origin: string | null): string => {
  const publicOrigin =
    Deno.env.get("PUBLIC_APP_URL") ||
    (origin && !origin.includes("localhost") ? origin : null) ||
    origin ||
    "http://localhost:8080";
  return `${publicOrigin.replace(/\/$/, "")}/reviews/${reviewId}`;
};

const normalizeKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const bookMatchKey = (book: Record<string, unknown> | null | undefined) =>
  `${normalizeKey(book?.title)}|${normalizeKey(book?.author)}`;

export const isVisibleReviewForUser = async (
  supabaseClient: SupabaseClient,
  review: Record<string, unknown> | null,
  viewerId: string
): Promise<boolean> => {
  if (!review || review.deleted_at) return false;
  const authorId = String(review.user_id || "");
  if (!authorId) return false;
  if (authorId === viewerId) return true;
  if (review.is_public === false) return false;

  const blocked = await getBlockedUserIds(supabaseClient, viewerId);
  return !blocked.has(authorId);
};

export const getReviewById = async (
  supabaseClient: SupabaseClient,
  reviewId: string
) => {
  const { data, error } = await supabaseClient
    .from("book_reviews")
    .select(REVIEW_SELECT)
    .eq("id", reviewId)
    .maybeSingle();

  if (error) throw error;
  return data as Record<string, unknown> | null;
};

export const enrichReviews = async (
  supabaseClient: SupabaseClient,
  reviews: Array<Record<string, unknown>>,
  viewerId: string,
  origin: string | null
) => {
  if (reviews.length === 0) return [];

  const reviewIds = reviews.map((review) => String(review.id));
  const [likesResult, viewerBooksResult, followingIds] = await Promise.all([
    supabaseClient
      .from("review_likes")
      .select("review_id")
      .eq("user_id", viewerId)
      .in("review_id", reviewIds),
    supabaseClient
      .from("books")
      .select("id,title,author,isbn,genre,status,date_finished")
      .eq("user_id", viewerId)
      .is("deleted_at", null),
    getFollowingIds(supabaseClient, viewerId),
  ]);

  if (likesResult.error) throw likesResult.error;
  if (viewerBooksResult.error) throw viewerBooksResult.error;

  const likedIds = new Set((likesResult.data || []).map((row) => row.review_id as string));
  const viewerBooks = (viewerBooksResult.data || []) as Array<Record<string, unknown>>;
  const viewerBookByIsbn = new Map<string, Record<string, unknown>>();
  const viewerBookByTitleAuthor = new Map<string, Record<string, unknown>>();
  const viewerGenres = new Set<string>();

  for (const book of viewerBooks) {
    const isbn = normalizeKey(book.isbn);
    if (isbn) viewerBookByIsbn.set(isbn, book);
    viewerBookByTitleAuthor.set(bookMatchKey(book), book);
    const genre = normalizeKey(book.genre);
    if (genre) viewerGenres.add(genre);
  }

  return reviews.map((review) => {
    const book = (review.books || null) as Record<string, unknown> | null;
    const authorId = String(review.user_id || "");
    const isbn = normalizeKey(book?.isbn);
    const viewerBook =
      (isbn && viewerBookByIsbn.get(isbn)) ||
      viewerBookByTitleAuthor.get(bookMatchKey(book)) ||
      null;
    const genre = normalizeKey(book?.genre);
    const fromFollowing = followingIds.has(authorId);
    const similarGenre = Boolean(genre && viewerGenres.has(genre));
    const isOwn = authorId === viewerId;
    const feedReason = isOwn
      ? "Your review"
      : fromFollowing
        ? "From your network"
        : similarGenre
          ? "Similar to your library"
          : "Community review";

    return {
      ...review,
      reviewer: review.profiles ?? null,
      book,
      profiles: review.profiles ?? null,
      books: book,
      user_has_liked: likedIds.has(String(review.id)),
      viewer_book_id: viewerBook ? String(viewerBook.id) : null,
      viewer_has_book: Boolean(viewerBook),
      feed_reason: feedReason,
      share_url: createReviewUrl(String(review.id), origin),
    };
  });
};

export const getCompletedBooksNeedingReviews = async (
  supabaseClient: SupabaseClient,
  viewerId: string,
  limit = 5
) => {
  const [booksResult, reviewsResult] = await Promise.all([
    supabaseClient
      .from("books")
      .select("id,title,author,cover_url,date_finished")
      .eq("user_id", viewerId)
      .eq("status", "completed")
      .is("deleted_at", null)
      .order("date_finished", { ascending: false, nullsFirst: false })
      .limit(20),
    supabaseClient
      .from("book_reviews")
      .select("book_id")
      .eq("user_id", viewerId)
      .is("deleted_at", null),
  ]);

  if (booksResult.error) throw booksResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  const reviewedIds = new Set((reviewsResult.data || []).map((row) => row.book_id as string));
  return (booksResult.data || [])
    .filter((book) => !reviewedIds.has(book.id as string))
    .slice(0, limit);
};
