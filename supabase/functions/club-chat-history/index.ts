import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import {
  CLUB_CHAT_MESSAGE_SELECT,
  enrichClubChatMessages,
  getBlockedUserIdsForUser,
  requireClubMember,
} from "../_shared/clubChat.ts";

interface ClubChatHistoryBody {
  club_id?: unknown;
  cursor?: unknown;
  limit?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const body = await parseJsonBody<ClubChatHistoryBody>(req);
    const clubId = typeof body.club_id === "string" ? body.club_id.trim() : "";
    const cursor = typeof body.cursor === "string" && body.cursor.trim() ? body.cursor.trim() : null;
    const limit = Math.min(Math.max(Number(body.limit || 40), 1), 80);

    if (!clubId) return jsonResponse({ error: "club_id is required" }, 400, origin);

    const membership = await requireClubMember(supabaseClient, clubId, authResult.user.id);
    if ("error" in membership) return jsonResponse({ error: membership.error }, membership.status, origin);

    const blockedIds = await getBlockedUserIdsForUser(supabaseClient, authResult.user.id);
    let query = supabaseClient
      .from("club_chat_messages")
      .select(CLUB_CHAT_MESSAGE_SELECT)
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      const [createdAt, id] = cursor.split("|");
      if (createdAt && id) {
        query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    const visible = (data || []).filter((message) => !blockedIds.has(String(message.user_id)));
    const page = visible.slice(0, limit).reverse();
    const hasMore = visible.length > limit;
    const oldest = page[0];
    const nextCursor = hasMore && oldest ? `${oldest.created_at}|${oldest.id}` : null;
    const messages = await enrichClubChatMessages(supabaseClient, page, authResult.user.id);

    const { data: settings, error: settingsError } = await supabaseClient
      .from("club_chat_user_settings")
      .select("*")
      .eq("club_id", clubId)
      .eq("user_id", authResult.user.id)
      .maybeSingle();
    if (settingsError) throw settingsError;

    return jsonResponse(
      {
        messages,
        next_cursor: nextCursor,
        has_more: hasMore,
        settings: settings || null,
      },
      200,
      origin,
    );
  } catch (error) {
    console.error("club-chat-history failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load club chat" },
      500,
      origin,
    );
  }
});
