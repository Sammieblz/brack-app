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
  enrichPosts,
  getBlockedUserIds,
  getFollowingIds,
  isVisiblePostForUser,
  type FeedCursor,
} from "../_shared/social.ts";

interface PostsFeedBody {
  cursor?: unknown;
  limit?: unknown;
  post_id?: unknown;
}

const POST_SELECT =
  "id,user_id,book_id,club_id,title,content,content_format,content_json,content_html,genre,post_type,visibility,likes_count,comments_count,share_count,metadata,deleted_at,created_at,updated_at";

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
      name: "posts-feed",
      identifier: authResult.user.id,
      limit: 180,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = req.method === "GET" ? {} : await parseJsonBody<PostsFeedBody>(req);
    const url = new URL(req.url);
    const limit = clampLimit(url.searchParams.get("limit") ?? body.limit, 20, 30);
    const postId = String(url.searchParams.get("post_id") ?? body.post_id ?? "");

    const blockedIds = await getBlockedUserIds(supabaseClient, authResult.user.id);
    const followingIds = await getFollowingIds(supabaseClient, authResult.user.id);

    if (postId) {
      const { data: post, error } = await supabaseClient
        .from("posts")
        .select(POST_SELECT)
        .eq("id", postId)
        .maybeSingle();
      if (error) throw error;
      if (
        !post ||
        !isVisiblePostForUser(post, authResult.user.id, followingIds, blockedIds)
      ) {
        return jsonResponse({ error: "Post not found" }, 404, origin);
      }
      const items = await enrichPosts(supabaseClient, [post], authResult.user.id, origin);
      return jsonResponse(
        {
          items,
          next_cursor: null,
          has_more: false,
          feed_mode: "detail",
          caught_up: false,
        },
        200,
        origin
      );
    }

    const cursor = decodeCursor(url.searchParams.get("cursor") ?? body.cursor);
    const source = cursor?.source === "discovery" ? "discovery" : "timeline";
    let posts: Array<Record<string, unknown>> = [];
    let nextCursor: FeedCursor | null = null;
    let feedMode: "following" | "discovery" | "mixed" | "caught_up" = "following";

    if (source === "timeline") {
      let feedQuery = supabaseClient
        .from("post_feed_items")
        .select("post_id,item_created_at,actor_id,source")
        .eq("viewer_id", authResult.user.id)
        .order("item_created_at", { ascending: false })
        .order("post_id", { ascending: false })
        .limit(limit);

      feedQuery = applyCursor(feedQuery, "item_created_at", "post_id", cursor);

      const { data: feedItems, error: feedError } = await feedQuery;
      if (feedError) throw feedError;

      const postIds = (feedItems || []).map((item) => item.post_id as string);
      if (postIds.length > 0) {
        const { data: timelinePosts, error: postsError } = await supabaseClient
          .from("posts")
          .select(POST_SELECT)
          .in("id", postIds)
          .is("deleted_at", null);
        if (postsError) throw postsError;

        const postMap = new Map((timelinePosts || []).map((post) => [post.id, post]));
        posts = postIds
          .map((id) => postMap.get(id))
          .filter(Boolean)
          .filter((post) =>
            isVisiblePostForUser(post, authResult.user.id, followingIds, blockedIds)
          ) as Array<Record<string, unknown>>;
      }

      if ((feedItems || []).length === limit && posts.length > 0) {
        const last = feedItems![feedItems!.length - 1];
        nextCursor = {
          source: "timeline",
          created_at: last.item_created_at,
          id: last.post_id,
        };
      }
    }

    if (posts.length < limit && source !== "discovery") {
      const remaining = limit - posts.length;
      const excludedActors = new Set([authResult.user.id, ...followingIds, ...blockedIds]);

      let discoveryQuery = supabaseClient
        .from("posts")
        .select(POST_SELECT)
        .eq("visibility", "public")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(remaining);

      if (excludedActors.size > 0) {
        discoveryQuery = discoveryQuery.not(
          "user_id",
          "in",
          `(${[...excludedActors].join(",")})`
        );
      }

      const { data: discoveryPosts, error: discoveryError } = await discoveryQuery;
      if (discoveryError) throw discoveryError;

      const filteredDiscovery = (discoveryPosts || []).filter((post) =>
        isVisiblePostForUser(post, authResult.user.id, followingIds, blockedIds)
      );
      if (filteredDiscovery.length > 0) {
        posts = [...posts, ...filteredDiscovery];
        feedMode = posts.length > filteredDiscovery.length ? "mixed" : "discovery";
        const last = filteredDiscovery[filteredDiscovery.length - 1];
        nextCursor =
          filteredDiscovery.length === remaining
            ? { source: "discovery", created_at: last.created_at, id: last.id }
            : null;
      }
    } else if (source === "discovery") {
      const excludedActors = new Set([authResult.user.id, ...followingIds, ...blockedIds]);
      let discoveryQuery = supabaseClient
        .from("posts")
        .select(POST_SELECT)
        .eq("visibility", "public")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);

      discoveryQuery = applyCursor(discoveryQuery, "created_at", "id", cursor);

      if (excludedActors.size > 0) {
        discoveryQuery = discoveryQuery.not(
          "user_id",
          "in",
          `(${[...excludedActors].join(",")})`
        );
      }

      const { data: discoveryPosts, error: discoveryError } = await discoveryQuery;
      if (discoveryError) throw discoveryError;

      posts = (discoveryPosts || []).filter((post) =>
        isVisiblePostForUser(post, authResult.user.id, followingIds, blockedIds)
      );
      feedMode = "discovery";
      if (posts.length === limit) {
        const last = posts[posts.length - 1];
        nextCursor = { source: "discovery", created_at: String(last.created_at), id: String(last.id) };
      }
    }

    if (posts.length === 0) {
      feedMode = "caught_up";
    }

    const items = await enrichPosts(supabaseClient, posts, authResult.user.id, origin);

    return jsonResponse(
      {
        items,
        next_cursor: encodeCursor(nextCursor),
        has_more: nextCursor !== null,
        feed_mode: feedMode,
        caught_up: posts.length === 0 || nextCursor === null,
      },
      200,
      origin
    );
  } catch (error) {
    console.error("posts-feed failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load posts feed" },
      500,
      origin
    );
  }
});
