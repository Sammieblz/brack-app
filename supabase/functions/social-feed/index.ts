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
  enrichActivities,
  getBlockedUserIds,
  type FeedCursor,
} from "../_shared/social.ts";

interface SocialFeedBody {
  cursor?: unknown;
  limit?: unknown;
}

const ACTIVITY_SELECT =
  "id,user_id,activity_type,book_id,review_id,list_id,badge_id,metadata,visibility,created_at";

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
      name: "social-feed",
      identifier: authResult.user.id,
      limit: 180,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = req.method === "GET" ? {} : await parseJsonBody<SocialFeedBody>(req);
    const url = new URL(req.url);
    const limit = clampLimit(url.searchParams.get("limit") ?? body.limit, 20, 50);
    const cursor = decodeCursor(url.searchParams.get("cursor") ?? body.cursor);
    const blockedIds = await getBlockedUserIds(supabaseClient, authResult.user.id);

    let feedQuery = supabaseClient
      .from("activity_feed_items")
      .select("activity_id,actor_id,item_created_at")
      .eq("viewer_id", authResult.user.id)
      .order("item_created_at", { ascending: false })
      .order("activity_id", { ascending: false })
      .limit(limit);

    feedQuery = applyCursor(feedQuery, "item_created_at", "activity_id", cursor);

    const { data: feedItems, error: feedError } = await feedQuery;
    if (feedError) throw feedError;

    const visibleFeedItems = (feedItems || []).filter(
      (item) => !blockedIds.has(item.actor_id as string)
    );
    const activityIds = visibleFeedItems.map((item) => item.activity_id as string);

    let activities: Array<Record<string, unknown>> = [];
    if (activityIds.length > 0) {
      const { data, error } = await supabaseClient
        .from("social_activities")
        .select(ACTIVITY_SELECT)
        .in("id", activityIds);
      if (error) throw error;
      const activityMap = new Map((data || []).map((activity) => [activity.id, activity]));
      activities = activityIds.map((id) => activityMap.get(id)).filter(Boolean) as Array<
        Record<string, unknown>
      >;
    }

    const enriched = await enrichActivities(supabaseClient, activities);
    const last = visibleFeedItems[visibleFeedItems.length - 1];
    const nextCursor: FeedCursor | null =
      visibleFeedItems.length === limit && last
        ? {
            source: "activity",
            created_at: last.item_created_at,
            id: last.activity_id,
          }
        : null;

    return jsonResponse(
      {
        activities: enriched,
        next_cursor: encodeCursor(nextCursor),
        has_more: nextCursor !== null,
        caught_up: enriched.length === 0 || nextCursor === null,
      },
      200,
      origin
    );
  } catch (error) {
    console.error("social-feed failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load social feed" },
      500,
      origin
    );
  }
});
