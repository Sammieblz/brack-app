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

interface CreatePostCommentBody {
  post_id?: unknown;
  parent_id?: unknown;
  content?: unknown;
}

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
      name: "create-post-comment",
      identifier: authResult.user.id,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<CreatePostCommentBody>(req);
    const postId = sanitizeString(body.post_id, 80);
    const parentId = sanitizeString(body.parent_id, 80) || null;
    const content = sanitizeString(body.content, 5000);

    if (!postId || !content) {
      return jsonResponse({ error: "post_id and content are required" }, 400, origin);
    }

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

    const { data: comment, error } = await supabaseClient
      .from("post_comments")
      .insert({
        post_id: postId,
        parent_id: parentId,
        user_id: authResult.user.id,
        content,
      })
      .select("*")
      .single();

    if (error) throw error;

    return jsonResponse({ comment }, 201, origin);
  } catch (error) {
    console.error("create-post-comment failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to add comment" },
      500,
      origin
    );
  }
});
