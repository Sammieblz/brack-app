import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  createPostUrl,
  getBlockedUserIds,
  getFollowingIds,
  isVisiblePostForUser,
  sanitizeString,
} from "../_shared/social.ts";

interface SharePostBody {
  post_id?: unknown;
  target?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "share-post",
      identifier: authResult.user.id,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<SharePostBody>(req);
    const postId = sanitizeString(body.post_id, 80);
    const target = sanitizeString(body.target, 80) || null;
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

    const { error } = await supabaseClient.from("post_shares").insert({
      post_id: postId,
      user_id: authResult.user.id,
      share_target: target,
    });
    if (error) throw error;

    const { data: updatedPost } = await supabaseClient
      .from("posts")
      .select("share_count")
      .eq("id", postId)
      .single();

    return jsonResponse(
      {
        share_url: createPostUrl(postId, origin),
        share_count: updatedPost?.share_count ?? 0,
      },
      200,
      origin
    );
  } catch (error) {
    console.error("share-post failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to share post" },
      500,
      origin
    );
  }
});
