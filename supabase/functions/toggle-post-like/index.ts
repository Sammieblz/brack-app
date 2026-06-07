import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  getBlockedUserIds,
  getFollowingIds,
  isVisiblePostForUser,
  sanitizeString,
} from "../_shared/social.ts";

interface TogglePostLikeBody {
  post_id?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "toggle-post-like",
      identifier: authResult.user.id,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<TogglePostLikeBody>(req);
    const postId = sanitizeString(body.post_id, 80);
    if (!postId) return jsonResponse({ error: "post_id is required" }, 400, origin);

    const { data: post, error: postError } = await supabaseClient
      .from("posts")
      .select("*")
      .eq("id", postId)
      .maybeSingle();
    if (postError) throw postError;

    const [blockedIds, followingIds] = await Promise.all([
      getBlockedUserIds(supabaseClient, authResult.user.id),
      getFollowingIds(supabaseClient, authResult.user.id),
    ]);

    if (
      !post ||
      !isVisiblePostForUser(post, authResult.user.id, followingIds, blockedIds)
    ) {
      return jsonResponse({ error: "Post not found" }, 404, origin);
    }

    const { data: existing, error: existingError } = await supabaseClient
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", authResult.user.id)
      .maybeSingle();
    if (existingError) throw existingError;

    let liked = false;
    if (existing) {
      const { error } = await supabaseClient
        .from("post_likes")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from("post_likes")
        .insert({ post_id: postId, user_id: authResult.user.id });
      if (error) throw error;
      liked = true;
    }

    const { data: updatedPost, error: countError } = await supabaseClient
      .from("posts")
      .select("likes_count")
      .eq("id", postId)
      .single();
    if (countError) throw countError;

    return jsonResponse(
      { liked, likes_count: updatedPost?.likes_count ?? 0 },
      200,
      origin
    );
  } catch (error) {
    console.error("toggle-post-like failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to update like" },
      500,
      origin
    );
  }
});
