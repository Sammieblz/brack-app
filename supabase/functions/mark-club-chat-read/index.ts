import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { requireClubMember } from "../_shared/clubChat.ts";

interface MarkClubChatReadBody {
  club_id?: unknown;
  last_read_message_id?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const body = await parseJsonBody<MarkClubChatReadBody>(req);
    const clubId = typeof body.club_id === "string" ? body.club_id.trim() : "";
    const messageId =
      typeof body.last_read_message_id === "string" && body.last_read_message_id.trim()
        ? body.last_read_message_id.trim()
        : null;

    if (!clubId) return jsonResponse({ error: "club_id is required" }, 400, origin);

    const membership = await requireClubMember(supabaseClient, clubId, authResult.user.id);
    if ("error" in membership) return jsonResponse({ error: membership.error }, membership.status, origin);

    if (messageId) {
      const { data: message, error: messageError } = await supabaseClient
        .from("club_chat_messages")
        .select("id,club_id")
        .eq("id", messageId)
        .eq("club_id", clubId)
        .maybeSingle();
      if (messageError) throw messageError;
      if (!message) return jsonResponse({ error: "Message not found" }, 404, origin);
    }

    const readAt = new Date().toISOString();
    const { error } = await supabaseClient.from("club_chat_reads").upsert(
      {
        club_id: clubId,
        user_id: authResult.user.id,
        last_read_message_id: messageId,
        read_at: readAt,
      },
      { onConflict: "club_id,user_id" },
    );
    if (error) throw error;

    await supabaseClient.from("club_chat_user_settings").upsert(
      {
        club_id: clubId,
        user_id: authResult.user.id,
        last_opened_at: readAt,
      },
      { onConflict: "club_id,user_id" },
    );

    return jsonResponse({ ok: true }, 200, origin);
  } catch (error) {
    console.error("mark-club-chat-read failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to mark club chat read" },
      500,
      origin,
    );
  }
});
