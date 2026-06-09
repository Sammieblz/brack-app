import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  enrichMessages,
  isPairBlocked,
  MESSAGE_REACTIONS,
  requireConversationAccess,
  type MessageReactionType,
} from "../_shared/messaging.ts";

interface ToggleMessageReactionBody {
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

    const userId = authResult.user.id;
    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "toggle-message-reaction",
      identifier: userId,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<ToggleMessageReactionBody>(req);
    const messageId = typeof body.message_id === "string" ? body.message_id.trim() : "";
    const reactionType =
      typeof body.reaction_type === "string" ? body.reaction_type.trim() : "";

    if (!messageId || !MESSAGE_REACTIONS.has(reactionType as MessageReactionType)) {
      return jsonResponse({ error: "Valid message_id and reaction_type are required" }, 400, origin);
    }

    const { data: message, error: messageError } = await supabaseClient
      .from("messages")
      .select("*")
      .eq("id", messageId)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!message) return jsonResponse({ error: "Message not found" }, 404, origin);
    if (message.deleted_at) return jsonResponse({ error: "Message was deleted" }, 400, origin);

    const access = await requireConversationAccess(supabaseClient, message.conversation_id, userId);
    if ("error" in access) return jsonResponse({ error: access.error }, access.status, origin);

    const blocked = await isPairBlocked(supabaseClient, userId, access.otherUserId);
    if (blocked) {
      return jsonResponse({ error: "Reactions are unavailable for this conversation" }, 403, origin);
    }

    const { data: existing, error: existingError } = await supabaseClient
      .from("message_reactions")
      .select("*")
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existingError) throw existingError;

    let activeReaction: string | null = reactionType;
    if (existing?.reaction_type === reactionType) {
      const { error } = await supabaseClient
        .from("message_reactions")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
      activeReaction = null;
    } else if (existing) {
      const { error } = await supabaseClient
        .from("message_reactions")
        .update({ reaction_type: reactionType })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.from("message_reactions").insert({
        message_id: messageId,
        conversation_id: message.conversation_id,
        user_id: userId,
        reaction_type: reactionType,
      });
      if (error) throw error;
    }

    const [updated] = await enrichMessages(supabaseClient, [message], userId, true);
    return jsonResponse({ reaction: activeReaction, message: updated }, 200, origin);
  } catch (error) {
    console.error("toggle-message-reaction failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to update reaction" },
      500,
      origin
    );
  }
});
