import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getClubRoles, type ClubRole } from "../_shared/clubs.ts";

interface ModerateDiscussionBody {
  discussionId?: unknown;
  action?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "moderate-club-discussion",
      identifier: authResult.user.id,
      limit: 100,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<ModerateDiscussionBody>(req);
    const discussionId = typeof body.discussionId === "string" ? body.discussionId : "";
    const action = typeof body.action === "string" ? body.action : "";
    if (!discussionId || !["delete", "restore", "pin", "unpin"].includes(action)) {
      return jsonResponse({ error: "Discussion id and action are required" }, 400, origin);
    }

    const { data: discussion, error: discussionError } = await supabaseClient
      .from("book_club_discussions")
      .select("id,club_id,user_id,parent_id")
      .eq("id", discussionId)
      .maybeSingle();
    if (discussionError) throw discussionError;
    if (!discussion) return jsonResponse({ error: "Discussion not found" }, 404, origin);

    const roleMap = await getClubRoles(supabaseClient, authResult.user.id, [discussion.club_id]);
    const role = roleMap.get(discussion.club_id) as ClubRole | undefined;
    const isAuthor = discussion.user_id === authResult.user.id;
    const canModerate = role === "admin" || role === "moderator";
    const adminOnlyAction = action === "pin" || action === "unpin";

    if (adminOnlyAction && role !== "admin") {
      return jsonResponse({ error: "Only admins can pin club discussions" }, 403, origin);
    }
    if (!adminOnlyAction && !canModerate && !isAuthor) {
      return jsonResponse({ error: "You do not have permission to moderate this discussion" }, 403, origin);
    }

    const updates: Record<string, unknown> = {};
    if (action === "delete") updates.deleted_at = new Date().toISOString();
    if (action === "restore") {
      if (!canModerate) return jsonResponse({ error: "Only moderators can restore posts" }, 403, origin);
      updates.deleted_at = null;
    }
    if (action === "pin") updates.is_pinned = true;
    if (action === "unpin") updates.is_pinned = false;

    const { data, error } = await supabaseClient
      .from("book_club_discussions")
      .update(updates)
      .eq("id", discussionId)
      .select("id,club_id,user_id,title,content,parent_id,discussion_type,is_pinned,reply_count,deleted_at,created_at,updated_at")
      .single();
    if (error) throw error;

    return jsonResponse({ discussion: data }, 200, origin);
  } catch (error) {
    console.error("moderate-club-discussion failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to moderate discussion" },
      500,
      origin,
    );
  }
});

