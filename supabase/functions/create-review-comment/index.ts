import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  COMMENT_SELECT,
  getReviewById,
  isVisibleReviewForUser,
  sanitizeString,
} from "../_shared/reviews.ts";

interface CreateReviewCommentBody {
  review_id?: unknown;
  content?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "create-review-comment",
      identifier: authResult.user.id,
      limit: 80,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<CreateReviewCommentBody>(req);
    const reviewId = String(body.review_id ?? "");
    const content = sanitizeString(body.content, 2000);
    if (!reviewId) return jsonResponse({ error: "Missing review_id" }, 400, origin);
    if (content.length < 1) return jsonResponse({ error: "Comment cannot be empty" }, 400, origin);

    const review = await getReviewById(supabaseClient, reviewId);
    const visible = await isVisibleReviewForUser(supabaseClient, review, authResult.user.id);
    if (!visible) return jsonResponse({ error: "Review not found" }, 404, origin);

    const { data: created, error: insertError } = await supabaseClient
      .from("review_comments")
      .insert({
        review_id: reviewId,
        user_id: authResult.user.id,
        content,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    const { data: comment, error: fetchError } = await supabaseClient
      .from("review_comments")
      .select(COMMENT_SELECT)
      .eq("id", created.id)
      .single();
    if (fetchError) throw fetchError;

    return jsonResponse({ comment }, 200, origin);
  } catch (error) {
    console.error("create-review-comment failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to add comment" },
      500,
      origin
    );
  }
});
