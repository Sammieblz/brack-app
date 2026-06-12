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
  normalizeTenorGif,
  normalizeUploadedMedia,
  requireConversationAccess,
  sanitizeString,
} from "../_shared/messaging.ts";

interface SendMessageBody {
  conversation_id?: unknown;
  content?: unknown;
  reply_to_message_id?: unknown;
  client_message_id?: unknown;
  media?: Array<Record<string, unknown>>;
  gif?: Record<string, unknown> | null;
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
      name: "send-message",
      identifier: userId,
      limit: 80,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<SendMessageBody>(req);
    const conversationId =
      typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";
    const content = sanitizeString(body.content, 5000);
    const replyToMessageId =
      typeof body.reply_to_message_id === "string" && body.reply_to_message_id.trim()
        ? body.reply_to_message_id.trim()
        : null;
    const clientMessageId = sanitizeString(body.client_message_id, 120) || null;

    if (!conversationId) {
      return jsonResponse({ error: "conversation_id is required" }, 400, origin);
    }

    const access = await requireConversationAccess(supabaseClient, conversationId, userId);
    if ("error" in access) return jsonResponse({ error: access.error }, access.status, origin);

    const blocked = await isPairBlocked(supabaseClient, userId, access.otherUserId);
    if (blocked) {
      return jsonResponse({ error: "Messaging is unavailable for this reader" }, 403, origin);
    }

    if (clientMessageId) {
      const { data: existing, error: existingError } = await supabaseClient
        .from("messages")
        .select("*")
        .eq("sender_id", userId)
        .eq("client_message_id", clientMessageId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const [message] = await enrichMessages(supabaseClient, [existing], userId, true);
        return jsonResponse({ message }, 200, origin);
      }
    }

    const uploadedMedia = normalizeUploadedMedia(userId, conversationId, body.media);
    const tenorGif = normalizeTenorGif(userId, conversationId, body.gif);
    const media = tenorGif ? [tenorGif] : uploadedMedia;

    if (!content && media.length === 0) {
      return jsonResponse({ error: "Message content or media is required" }, 400, origin);
    }

    const messageType = tenorGif ? "gif" : media.length > 0 ? "media" : "text";
    const { data: message, error: messageError } = await supabaseClient
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: content || null,
        message_type: messageType,
        reply_to_message_id: replyToMessageId,
        client_message_id: clientMessageId,
        is_read: false,
        metadata: {
          media_count: media.length,
        },
      })
      .select("*")
      .single();

    if (messageError) throw messageError;

    if (media.length > 0) {
      const { error: mediaError } = await supabaseClient.from("message_media").insert(
        media.map((item, index) => ({
          ...item,
          message_id: message.id,
          position: index,
        }))
      );
      if (mediaError) throw mediaError;
    }

    await Promise.all([
      supabaseClient.from("conversation_user_settings").upsert(
        {
          conversation_id: conversationId,
          user_id: userId,
          hidden_at: null,
          is_archived: false,
          last_opened_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id,user_id" }
      ),
      supabaseClient.from("conversation_reads").upsert(
        {
          conversation_id: conversationId,
          user_id: userId,
          last_read_message_id: message.id,
          read_at: message.created_at,
        },
        { onConflict: "conversation_id,user_id" }
      ),
    ]);

    const [enriched] = await enrichMessages(supabaseClient, [message], userId, true);
    return jsonResponse({ message: enriched }, 201, origin);
  } catch (error) {
    console.error("send-message failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      500,
      origin
    );
  }
});
