import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getBlockedUserIds, getFollowingIds } from "../_shared/social.ts";
import {
  applyReviewCursor,
  clampLimit,
  decodeReviewCursor,
  encodeReviewCursor,
  enrichReviews,
  getCompletedBooksNeedingReviews,
  REVIEW_SELECT,
  sanitizeString,
  type ReviewScope,
  type ReviewSort,
} from "../_shared/reviews.ts";

interface ReviewsFeedBody {
  cursor?: unknown;
  limit?: unknown;
  query?: unknown;
  rating?: unknown;
  scope?: unknown;
  sort?: unknown;
}

const REVIEW_SCOPES = new Set(["for_you", "following", "recent", "popular", "mine"]);
const REVIEW_SORTS = new Set(["personalized", "recent", "popular"]);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return optionsResponse(origin);
  }

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "reviews-feed",
      identifier: authResult.user.id,
      limit: 180,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = req.method === "GET" ? {} : await parseJsonBody<ReviewsFeedBody>(req);
    const url = new URL(req.url);
    const limit = clampLimit(url.searchParams.get("limit") ?? body.limit, 20, 30);
    const queryText = sanitizeString(url.searchParams.get("query") ?? body.query, 120);
    const ratingRaw = url.searchParams.get("rating") ?? body.rating;
    const rating = Number.parseInt(String(ratingRaw ?? ""), 10);
    const requestedScope = String(url.searchParams.get("scope") ?? body.scope ?? "for_you");
    const scope = (REVIEW_SCOPES.has(requestedScope) ? requestedScope : "for_you") as ReviewScope;
    const requestedSort = String(
      url.searchParams.get("sort") ?? body.sort ?? (scope === "popular" ? "popular" : "personalized")
    );
    const sort = (REVIEW_SORTS.has(requestedSort) ? requestedSort : "personalized") as ReviewSort;
    const orderMode = sort === "popular" || scope === "popular" ? "popular" : "recent";
    const cursor = decodeReviewCursor(url.searchParams.get("cursor") ?? body.cursor);

    const [blockedIds, followingIds] = await Promise.all([
      getBlockedUserIds(supabaseClient, authResult.user.id),
      getFollowingIds(supabaseClient, authResult.user.id),
    ]);

    if (scope === "following" && followingIds.size === 0) {
      const opportunities = await getCompletedBooksNeedingReviews(
        supabaseClient,
        authResult.user.id
      );
      return jsonResponse(
        {
          items: [],
          next_cursor: null,
          has_more: false,
          caught_up: true,
          feed_mode: "following",
          summary: {
            rating_mix: [5, 4, 3, 2, 1].map((ratingValue) => ({ rating: ratingValue, count: 0 })),
            trending_books: [],
            review_opportunities: opportunities,
          },
        },
        200,
        origin
      );
    }

    let feedQuery = supabaseClient
      .from("book_reviews")
      .select(REVIEW_SELECT)
      .is("deleted_at", null)
      .limit(limit);

    if (scope !== "mine") {
      feedQuery = feedQuery.eq("is_public", true);
    } else {
      feedQuery = feedQuery.eq("user_id", authResult.user.id);
    }

    if (blockedIds.size > 0) {
      feedQuery = feedQuery.not("user_id", "in", `(${[...blockedIds].join(",")})`);
    }

    if (scope === "following") {
      feedQuery = feedQuery.in("user_id", [...followingIds]);
    }

    if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
      feedQuery = feedQuery.eq("rating", rating);
    }

    if (queryText) {
      const pattern = `%${queryText.replace(/[%_]/g, "")}%`;
      const [bookMatches, profileMatches] = await Promise.all([
        supabaseClient
          .from("books")
          .select("id")
          .or(`title.ilike.${pattern},author.ilike.${pattern},isbn.ilike.${pattern}`)
          .limit(80),
        supabaseClient
          .from("profiles")
          .select("id")
          .ilike("display_name", pattern)
          .limit(80),
      ]);

      if (bookMatches.error) throw bookMatches.error;
      if (profileMatches.error) throw profileMatches.error;

      const reviewFilters = [`title.ilike.${pattern}`, `content.ilike.${pattern}`];
      const bookIds = (bookMatches.data || []).map((row) => row.id as string);
      const profileIds = (profileMatches.data || []).map((row) => row.id as string);

      if (bookIds.length > 0) {
        reviewFilters.push(`book_id.in.(${bookIds.join(",")})`);
      }
      if (profileIds.length > 0) {
        reviewFilters.push(`user_id.in.(${profileIds.join(",")})`);
      }

      feedQuery = feedQuery.or(reviewFilters.join(","));
    }

    feedQuery = applyReviewCursor(feedQuery, cursor, orderMode);

    if (orderMode === "popular") {
      feedQuery = feedQuery
        .order("likes_count", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
    } else {
      feedQuery = feedQuery
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
    }

    const { data, error } = await feedQuery;
    if (error) throw error;

    const rows = (data || []) as Array<Record<string, unknown>>;
    const enriched = await enrichReviews(supabaseClient, rows, authResult.user.id, origin);
    const items =
      scope === "for_you"
        ? enriched.sort((a, b) => {
            const score = (item: Record<string, unknown>) =>
              (item.feed_reason === "From your network" ? 30 : 0) +
              (item.feed_reason === "Similar to your library" ? 15 : 0) +
              Number(item.likes_count ?? 0) * 2 +
              Number(item.comments_count ?? 0);
            const diff = score(b) - score(a);
            if (diff !== 0) return diff;
            return String(b.created_at).localeCompare(String(a.created_at));
          })
        : enriched;

    const last = rows[rows.length - 1];
    const nextCursor =
      rows.length === limit && last
        ? {
            sort: orderMode,
            created_at: String(last.created_at),
            id: String(last.id),
            value: Number(last.likes_count ?? 0),
          }
        : null;

    const ratingCounts = new Map<number, number>();
    const trendingMap = new Map<
      string,
      {
        id: string;
        title: string;
        author: string | null;
        cover_url: string | null;
        review_count: number;
        average_rating_total: number;
      }
    >();

    for (const item of items) {
      const itemRating = Number(item.rating);
      ratingCounts.set(itemRating, (ratingCounts.get(itemRating) || 0) + 1);
      const book = item.book as Record<string, unknown> | null;
      if (book?.id) {
        const existing = trendingMap.get(String(book.id)) || {
          id: String(book.id),
          title: String(book.title || "Untitled book"),
          author: book.author ? String(book.author) : null,
          cover_url: book.cover_url ? String(book.cover_url) : null,
          review_count: 0,
          average_rating_total: 0,
        };
        existing.review_count += 1;
        existing.average_rating_total += itemRating;
        trendingMap.set(existing.id, existing);
      }
    }

    const opportunities = await getCompletedBooksNeedingReviews(supabaseClient, authResult.user.id);

    return jsonResponse(
      {
        items,
        next_cursor: encodeReviewCursor(nextCursor),
        has_more: nextCursor !== null,
        caught_up: nextCursor === null,
        feed_mode: scope,
        summary: {
          rating_mix: [5, 4, 3, 2, 1].map((ratingValue) => ({
            rating: ratingValue,
            count: ratingCounts.get(ratingValue) || 0,
          })),
          trending_books: [...trendingMap.values()]
            .map((book) => ({
              ...book,
              average_rating: book.review_count
                ? Math.round((book.average_rating_total / book.review_count) * 10) / 10
                : null,
            }))
            .sort((a, b) => b.review_count - a.review_count)
            .slice(0, 5),
          review_opportunities: opportunities,
        },
      },
      200,
      origin
    );
  } catch (error) {
    console.error("reviews-feed failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load reviews" },
      500,
      origin
    );
  }
});
