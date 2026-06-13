import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getReviewById, isVisibleReviewForUser } from "../_shared/reviews.ts";

interface ToggleReviewLikeBody {
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
      name: "toggle-review-like",
      identifier: authResult.user.id,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<ToggleReviewLikeBody>(req);
    const reviewId = String(body.review_id ?? "");
    if (!reviewId) return jsonResponse({ error: "Missing review_id" }, 400, origin);

    const review = await getReviewById(supabaseClient, reviewId);
    const visible = await isVisibleReviewForUser(supabaseClient, review, authResult.user.id);
    if (!visible) return jsonResponse({ error: "Review not found" }, 404, origin);

    const { data: existing, error: existingError } = await supabaseClient
      .from("review_likes")
      .select("id")
      .eq("review_id", reviewId)
      .eq("user_id", authResult.user.id)
      .maybeSingle();
    if (existingError) throw existingError;

    let liked = false;
    if (existing) {
      const { error } = await supabaseClient
        .from("review_likes")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from("review_likes")
        .insert({ review_id: reviewId, user_id: authResult.user.id });
      if (error) throw error;
      liked = true;
    }

    const { data: updated, error: updatedError } = await supabaseClient
      .from("book_reviews")
      .select("likes_count")
      .eq("id", reviewId)
      .single();
    if (updatedError) throw updatedError;

    return jsonResponse(
      { liked, likes_count: Number(updated.likes_count ?? 0) },
      200,
      origin
    );
  } catch (error) {
    console.error("toggle-review-like failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to update like" },
      500,
      origin
    );
  }
});
