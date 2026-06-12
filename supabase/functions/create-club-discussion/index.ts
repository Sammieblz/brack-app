import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { sanitizeString } from "../_shared/social.ts";
import {
  DISCUSSION_SELECT,
  normalizeClubMediaItems,
  requireClubRole,
  signClubMediaItems,
  type ClubRole,
} from "../_shared/clubs.ts";

interface CreateDiscussionBody {
  clubId?: unknown;
  title?: unknown;
  content?: unknown;
  parentId?: unknown;
  parent_id?: unknown;
  discussionType?: unknown;
  discussion_type?: unknown;
  isPinned?: unknown;
  is_pinned?: unknown;
  media?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "create-club-discussion",
      identifier: authResult.user.id,
      limit: 80,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<CreateDiscussionBody>(req);
    const clubId = typeof body.clubId === "string" ? body.clubId : "";
    const parentId =
      typeof body.parentId === "string"
        ? body.parentId
        : typeof body.parent_id === "string"
          ? body.parent_id
          : null;
    const content = sanitizeString(body.content, 5000);
    const title = sanitizeString(body.title, 160);
    const requestedType = body.discussionType || body.discussion_type;
    const discussionType = requestedType === "announcement" ? "announcement" : "discussion";
    const isPinned = Boolean(body.isPinned || body.is_pinned);
    const media = normalizeClubMediaItems(body.media, authResult.user.id);

    if (!clubId || !content) {
      return jsonResponse({ error: "Club id and content are required" }, 400, origin);
    }

    const role = await requireClubRole(
      supabaseClient,
      clubId,
      authResult.user.id,
      ["admin", "moderator", "member"],
    ) as ClubRole;
    if ((discussionType === "announcement" || isPinned) && role !== "admin") {
      return jsonResponse({ error: "Only admins can post announcements or pin discussions" }, 403, origin);
    }

    if (parentId) {
      const { data: parent, error: parentError } = await supabaseClient
        .from("book_club_discussions")
        .select("id,club_id,deleted_at")
        .eq("id", parentId)
        .eq("club_id", clubId)
        .maybeSingle();
      if (parentError) throw parentError;
      if (!parent || parent.deleted_at) {
        return jsonResponse({ error: "Parent discussion not found" }, 404, origin);
      }
    }

    const { data, error } = await supabaseClient
      .from("book_club_discussions")
      .insert({
        club_id: clubId,
        user_id: authResult.user.id,
        title: parentId ? null : title || null,
        content,
        parent_id: parentId,
        discussion_type: parentId ? "discussion" : discussionType,
        is_pinned: parentId ? false : isPinned,
        media,
      })
      .select(DISCUSSION_SELECT)
      .single();
    if (error) throw error;

    await supabaseClient
      .from("book_clubs")
      .update({ last_activity_at: new Date().toISOString() })
      .eq("id", clubId);

    return jsonResponse(
      {
        discussion: {
          ...data,
          media: await signClubMediaItems(supabaseClient, data.media),
          replies: [],
        },
      },
      201,
      origin,
    );
  } catch (error) {
    console.error("create-club-discussion failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to create discussion" },
      500,
      origin,
    );
  }
});
