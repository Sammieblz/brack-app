import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface DeleteReviewBody {
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
      name: "delete-review",
      identifier: authResult.user.id,
      limit: 40,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<DeleteReviewBody>(req);
    const reviewId = String(body.review_id ?? "");
    if (!reviewId) return jsonResponse({ error: "Missing review_id" }, 400, origin);

    const { data: review, error: fetchError } = await supabaseClient
      .from("book_reviews")
      .select("id,user_id")
      .eq("id", reviewId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!review || review.user_id !== authResult.user.id) {
      return jsonResponse({ error: "Review not found" }, 404, origin);
    }

    const { error } = await supabaseClient
      .from("book_reviews")
      .update({ deleted_at: new Date().toISOString(), is_public: false })
      .eq("id", reviewId);
    if (error) throw error;

    return jsonResponse({ success: true }, 200, origin);
  } catch (error) {
    console.error("delete-review failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to delete review" },
      500,
      origin
    );
  }
});
