import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { createReviewUrl, getReviewById, isVisibleReviewForUser } from "../_shared/reviews.ts";

interface ShareReviewBody {
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
      name: "share-review",
      identifier: authResult.user.id,
      limit: 80,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<ShareReviewBody>(req);
    const reviewId = String(body.review_id ?? "");
    if (!reviewId) return jsonResponse({ error: "Missing review_id" }, 400, origin);

    const review = await getReviewById(supabaseClient, reviewId);
    const visible = await isVisibleReviewForUser(supabaseClient, review, authResult.user.id);
    if (!visible) return jsonResponse({ error: "Review not found" }, 404, origin);

    const { data, error } = await supabaseClient
      .from("book_reviews")
      .update({ share_count: Number(review?.share_count ?? 0) + 1 })
      .eq("id", reviewId)
      .select("share_count")
      .single();
    if (error) throw error;

    return jsonResponse(
      {
        share_url: createReviewUrl(reviewId, origin),
        share_count: Number(data.share_count ?? 0),
      },
      200,
      origin
    );
  } catch (error) {
    console.error("share-review failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to share review" },
      500,
      origin
    );
  }
});
