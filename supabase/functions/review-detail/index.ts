import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  enrichReviews,
  getReviewById,
  isVisibleReviewForUser,
  REVIEW_SELECT,
} from "../_shared/reviews.ts";

interface ReviewDetailBody {
  review_id?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "review-detail",
      identifier: authResult.user.id,
      limit: 240,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<ReviewDetailBody>(req);
    const url = new URL(req.url);
    const reviewId = String(url.searchParams.get("review_id") ?? body.review_id ?? "");
    if (!reviewId) return jsonResponse({ error: "Missing review_id" }, 400, origin);

    const review = await getReviewById(supabaseClient, reviewId);
    const visible = await isVisibleReviewForUser(supabaseClient, review, authResult.user.id);
    if (!visible || !review) {
      return jsonResponse({ error: "Review not found" }, 404, origin);
    }

    const [item] = await enrichReviews(supabaseClient, [review], authResult.user.id, origin);
    const bookId = String(review.book_id || "");

    const { data: related, error: relatedError } = await supabaseClient
      .from("book_reviews")
      .select(REVIEW_SELECT)
      .eq("book_id", bookId)
      .eq("is_public", true)
      .is("deleted_at", null)
      .neq("id", reviewId)
      .order("created_at", { ascending: false })
      .limit(6);
    if (relatedError) throw relatedError;

    const relatedItems = await enrichReviews(
      supabaseClient,
      (related || []) as Array<Record<string, unknown>>,
      authResult.user.id,
      origin
    );

    return jsonResponse({ review: item, related_reviews: relatedItems }, 200, origin);
  } catch (error) {
    console.error("review-detail failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load review" },
      500,
      origin
    );
  }
});
