import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import {
  CLUB_CHAT_MESSAGE_SELECT,
  canModerateClub,
  enrichClubChatMessages,
  requireClubMember,
} from "../_shared/clubChat.ts";

interface DeleteClubChatMessageBody {
  message_id?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const body = await parseJsonBody<DeleteClubChatMessageBody>(req);
    const messageId = typeof body.message_id === "string" ? body.message_id.trim() : "";
    if (!messageId) return jsonResponse({ error: "message_id is required" }, 400, origin);

    const { data: message, error: messageError } = await supabaseClient
      .from("club_chat_messages")
      .select(CLUB_CHAT_MESSAGE_SELECT)
      .eq("id", messageId)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!message) return jsonResponse({ error: "Message not found" }, 404, origin);

    const membership = await requireClubMember(supabaseClient, message.club_id, authResult.user.id);
    if ("error" in membership) return jsonResponse({ error: membership.error }, membership.status, origin);

    const canDelete =
      message.user_id === authResult.user.id ||
      (await canModerateClub(supabaseClient, message.club_id, authResult.user.id));
    if (!canDelete) return jsonResponse({ error: "Not allowed" }, 403, origin);

    const deletedAt = new Date().toISOString();
    const { data: updated, error } = await supabaseClient
      .from("club_chat_messages")
      .update({
        content: null,
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq("id", messageId)
      .select(CLUB_CHAT_MESSAGE_SELECT)
      .single();
    if (error) throw error;

    const [enriched] = await enrichClubChatMessages(supabaseClient, [updated], authResult.user.id);
    return jsonResponse({ message: enriched }, 200, origin);
  } catch (error) {
    console.error("delete-club-chat-message failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to delete club message" },
      500,
      origin,
    );
  }
});
