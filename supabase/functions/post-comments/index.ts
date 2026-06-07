import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  applyCursor,
  clampLimit,
  decodeCursor,
  encodeCursor,
  getBlockedUserIds,
  getFollowingIds,
  isVisiblePostForUser,
  type FeedCursor,
} from "../_shared/social.ts";

interface PostCommentsBody {
  post_id?: unknown;
  parent_id?: unknown;
  cursor?: unknown;
  limit?: unknown;
}

const COMMENT_SELECT =
  "id,post_id,user_id,parent_id,root_comment_id,content,depth,reply_count,deleted_at,created_at,updated_at";

const enrichComments = async (
  supabaseClient: ReturnType<typeof createServiceClient>,
  comments: Array<Record<string, unknown>>
) => {
  const userIds = [...new Set(comments.map((comment) => String(comment.user_id)))];
  const { data: profiles, error } = userIds.length
    ? await supabaseClient
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds)
    : { data: [], error: null };
  if (error) throw error;
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

  return comments.map((comment) => ({
    ...comment,
    content: comment.deleted_at ? "" : comment.content,
    is_deleted: Boolean(comment.deleted_at),
    user: comment.deleted_at ? null : profileMap.get(String(comment.user_id)) ?? null,
  }));
};

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
      name: "post-comments",
      identifier: authResult.user.id,
      limit: 240,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = req.method === "GET" ? {} : await parseJsonBody<PostCommentsBody>(req);
    const url = new URL(req.url);
    const postId = String(url.searchParams.get("post_id") ?? body.post_id ?? "");
    const parentId = String(url.searchParams.get("parent_id") ?? body.parent_id ?? "");
    const cursor = decodeCursor(url.searchParams.get("cursor") ?? body.cursor);
    const limit = clampLimit(url.searchParams.get("limit") ?? body.limit, 20, 50);

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

    let query = supabaseClient
      .from("post_comments")
      .select(COMMENT_SELECT)
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);

    if (parentId) {
      query = query.eq("parent_id", parentId);
    } else {
      query = query.is("parent_id", null);
    }

    query = applyCursor(query, "created_at", "id", cursor);

    const { data, error } = await query;
    if (error) throw error;

    const comments = await enrichComments(supabaseClient, data || []);
    const last = comments[comments.length - 1];
    const nextCursor: FeedCursor | null =
      comments.length === limit && last
        ? {
            source: "activity",
            created_at: String(last.created_at),
            id: String(last.id),
          }
        : null;

    return jsonResponse(
      {
        comments,
        next_cursor: encodeCursor(nextCursor),
        has_more: nextCursor !== null,
      },
      200,
      origin
    );
  } catch (error) {
    console.error("post-comments failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load comments" },
      500,
      origin
    );
  }
});
