import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import {
  CLUB_CHAT_MESSAGE_SELECT,
  CLUB_CHAT_REACTIONS,
  enrichClubChatMessages,
  isClubPairBlocked,
  requireClubMember,
  type ClubChatReactionType,
} from "../_shared/clubChat.ts";

interface ToggleClubChatReactionBody {
  message_id?: unknown;
  reaction_type?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const body = await parseJsonBody<ToggleClubChatReactionBody>(req);
    const messageId = typeof body.message_id === "string" ? body.message_id.trim() : "";
    const reactionType = body.reaction_type as ClubChatReactionType;

    if (!messageId || !CLUB_CHAT_REACTIONS.has(reactionType)) {
      return jsonResponse({ error: "message_id and valid reaction_type are required" }, 400, origin);
    }

    const { data: message, error: messageError } = await supabaseClient
      .from("club_chat_messages")
      .select(CLUB_CHAT_MESSAGE_SELECT)
      .eq("id", messageId)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!message || message.deleted_at) return jsonResponse({ error: "Message not found" }, 404, origin);

    const membership = await requireClubMember(supabaseClient, message.club_id, authResult.user.id);
    if ("error" in membership) return jsonResponse({ error: membership.error }, membership.status, origin);

    if (await isClubPairBlocked(supabaseClient, authResult.user.id, message.user_id)) {
      return jsonResponse({ error: "Message unavailable" }, 403, origin);
    }

    const { data: existing, error: existingError } = await supabaseClient
      .from("club_chat_reactions")
      .select("*")
      .eq("message_id", messageId)
      .eq("user_id", authResult.user.id)
      .maybeSingle();
    if (existingError) throw existingError;

    let currentReaction: ClubChatReactionType | null = reactionType;
    if (existing?.reaction_type === reactionType) {
      const { error } = await supabaseClient
        .from("club_chat_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", authResult.user.id);
      if (error) throw error;
      currentReaction = null;
    } else {
      const { error } = await supabaseClient.from("club_chat_reactions").upsert(
        {
          message_id: messageId,
          club_id: message.club_id,
          user_id: authResult.user.id,
          reaction_type: reactionType,
        },
        { onConflict: "message_id,user_id" },
      );
      if (error) throw error;
    }

    const [enriched] = await enrichClubChatMessages(supabaseClient, [message], authResult.user.id);
    return jsonResponse({ reaction: currentReaction, message: enriched }, 200, origin);
  } catch (error) {
    console.error("toggle-club-chat-reaction failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to update reaction" },
      500,
      origin,
    );
  }
});
