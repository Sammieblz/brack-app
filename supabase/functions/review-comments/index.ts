import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  clampLimit,
  COMMENT_SELECT,
  getReviewById,
  isVisibleReviewForUser,
} from "../_shared/reviews.ts";

interface ReviewCommentsBody {
  review_id?: unknown;
  cursor?: unknown;
  limit?: unknown;
}

type CommentCursor = {
  created_at: string;
  id: string;
};

const encodeCursor = (cursor: CommentCursor | null): string | null =>
  cursor ? btoa(JSON.stringify(cursor)) : null;

const decodeCursor = (value: unknown): CommentCursor | null => {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(atob(value)) as CommentCursor;
    if (!parsed.created_at || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "review-comments",
      identifier: authResult.user.id,
      limit: 180,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<ReviewCommentsBody>(req);
    const url = new URL(req.url);
    const reviewId = String(url.searchParams.get("review_id") ?? body.review_id ?? "");
    const limit = clampLimit(url.searchParams.get("limit") ?? body.limit, 20, 50);
    const cursor = decodeCursor(url.searchParams.get("cursor") ?? body.cursor);
    if (!reviewId) return jsonResponse({ error: "Missing review_id" }, 400, origin);

    const review = await getReviewById(supabaseClient, reviewId);
    const visible = await isVisibleReviewForUser(supabaseClient, review, authResult.user.id);
    if (!visible) return jsonResponse({ error: "Review not found" }, 404, origin);

    let query = supabaseClient
      .from("review_comments")
      .select(COMMENT_SELECT)
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit);

    if (cursor) {
      query = query.or(
        `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const comments = data || [];
    const last = comments[comments.length - 1];
    return jsonResponse(
      {
        comments,
        next_cursor:
          comments.length === limit && last
            ? encodeCursor({ created_at: last.created_at, id: last.id })
            : null,
        has_more: comments.length === limit,
      },
      200,
      origin
    );
  } catch (error) {
    console.error("review-comments failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load comments" },
      500,
      origin
    );
  }
});
