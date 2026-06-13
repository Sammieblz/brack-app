import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { enrichReviews, REVIEW_SELECT, sanitizeString } from "../_shared/reviews.ts";

interface CreateReviewBody {
  book_id?: unknown;
  rating?: unknown;
  title?: unknown;
  content?: unknown;
  is_spoiler?: unknown;
  is_public?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "create-review",
      identifier: authResult.user.id,
      limit: 40,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<CreateReviewBody>(req);
    const bookId = String(body.book_id ?? "");
    const rating = Number.parseInt(String(body.rating ?? ""), 10);
    const title = sanitizeString(body.title, 200) || null;
    const content = sanitizeString(body.content, 5000);

    if (!bookId) return jsonResponse({ error: "Missing book_id" }, 400, origin);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return jsonResponse({ error: "Rating must be between 1 and 5" }, 400, origin);
    }
    if (content.length < 10) {
      return jsonResponse({ error: "Review must be at least 10 characters" }, 400, origin);
    }

    const { data: book, error: bookError } = await supabaseClient
      .from("books")
      .select("id,user_id")
      .eq("id", bookId)
      .eq("user_id", authResult.user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (bookError) throw bookError;
    if (!book) return jsonResponse({ error: "Book not found" }, 404, origin);

    const payload = {
      user_id: authResult.user.id,
      book_id: bookId,
      rating,
      title,
      content,
      is_spoiler: body.is_spoiler === true,
      is_public: body.is_public !== false,
      deleted_at: null,
    };

    const { data: existing, error: existingError } = await supabaseClient
      .from("book_reviews")
      .select("id")
      .eq("user_id", authResult.user.id)
      .eq("book_id", bookId)
      .maybeSingle();
    if (existingError) throw existingError;

    let reviewId = existing?.id as string | undefined;
    if (reviewId) {
      const { error: updateError } = await supabaseClient
        .from("book_reviews")
        .update(payload)
        .eq("id", reviewId);
      if (updateError) throw updateError;
    } else {
      const { data: created, error: insertError } = await supabaseClient
        .from("book_reviews")
        .insert(payload)
        .select("id")
        .single();
      if (insertError) throw insertError;
      reviewId = created.id as string;
    }

    const { data: saved, error: savedError } = await supabaseClient
      .from("book_reviews")
      .select(REVIEW_SELECT)
      .eq("id", reviewId)
      .single();
    if (savedError) throw savedError;

    const [review] = await enrichReviews(
      supabaseClient,
      [saved as Record<string, unknown>],
      authResult.user.id,
      origin
    );

    return jsonResponse({ review, review_id: reviewId }, 200, origin);
  } catch (error) {
    console.error("create-review failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to save review" },
      500,
      origin
    );
  }
});
