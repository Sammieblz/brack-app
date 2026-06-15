import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  CLUB_CHAT_MESSAGE_SELECT,
  enrichClubChatMessages,
  extractMentionIds,
  normalizeClubChatTenorGif,
  normalizeClubChatUploadedMedia,
  requireClubMember,
} from "../_shared/clubChat.ts";
import { sanitizeString } from "../_shared/messaging.ts";

interface SendClubChatMessageBody {
  club_id?: unknown;
  content?: unknown;
  reply_to_message_id?: unknown;
  client_message_id?: unknown;
  media?: Array<Record<string, unknown>>;
  gif?: Record<string, unknown> | null;
  mention_ids?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "send-club-chat-message",
      identifier: authResult.user.id,
      limit: 100,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<SendClubChatMessageBody>(req);
    const clubId = typeof body.club_id === "string" ? body.club_id.trim() : "";
    const content = sanitizeString(body.content, 5000);
    const replyToMessageId =
      typeof body.reply_to_message_id === "string" && body.reply_to_message_id.trim()
        ? body.reply_to_message_id.trim()
        : null;
    const clientMessageId = sanitizeString(body.client_message_id, 120) || crypto.randomUUID();

    if (!clubId) return jsonResponse({ error: "club_id is required" }, 400, origin);

    const membership = await requireClubMember(supabaseClient, clubId, authResult.user.id);
    if ("error" in membership) return jsonResponse({ error: membership.error }, membership.status, origin);

    if (clientMessageId) {
      const { data: existing, error: existingError } = await supabaseClient
        .from("club_chat_messages")
        .select(CLUB_CHAT_MESSAGE_SELECT)
        .eq("user_id", authResult.user.id)
        .eq("client_message_id", clientMessageId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const [message] = await enrichClubChatMessages(supabaseClient, [existing], authResult.user.id);
        return jsonResponse({ message }, 200, origin);
      }
    }

    if (replyToMessageId) {
      const { data: replyTarget, error: replyError } = await supabaseClient
        .from("club_chat_messages")
        .select("id,club_id,deleted_at")
        .eq("id", replyToMessageId)
        .eq("club_id", clubId)
        .maybeSingle();
      if (replyError) throw replyError;
      if (!replyTarget || replyTarget.deleted_at) {
        return jsonResponse({ error: "Reply target not found" }, 404, origin);
      }
    }

    const uploadedMedia = normalizeClubChatUploadedMedia(authResult.user.id, clubId, body.media);
    const tenorGif = normalizeClubChatTenorGif(authResult.user.id, clubId, body.gif);
    const media = tenorGif ? [tenorGif] : uploadedMedia;

    if (!content && media.length === 0) {
      return jsonResponse({ error: "Message content or media is required" }, 400, origin);
    }

    const messageType = tenorGif ? "gif" : media.length > 0 ? "media" : "text";
    const { data: message, error: messageError } = await supabaseClient
      .from("club_chat_messages")
      .insert({
        club_id: clubId,
        user_id: authResult.user.id,
        content: content || null,
        message_type: messageType,
        reply_to_message_id: replyToMessageId,
        client_message_id: clientMessageId,
        metadata: { media_count: media.length },
      })
      .select(CLUB_CHAT_MESSAGE_SELECT)
      .single();
    if (messageError) throw messageError;

    if (media.length > 0) {
      const { error: mediaError } = await supabaseClient.from("club_chat_media").insert(
        media.map((item, index) => ({
          ...item,
          message_id: message.id,
          position: index,
        })),
      );
      if (mediaError) throw mediaError;
    }

    const mentionIds = await extractMentionIds(supabaseClient, clubId, authResult.user.id, body.mention_ids);
    if (mentionIds.length > 0) {
      const { error: mentionsError } = await supabaseClient.from("club_chat_mentions").insert(
        mentionIds.map((mentionedUserId) => ({
          message_id: message.id,
          club_id: clubId,
          mentioned_user_id: mentionedUserId,
          created_by: authResult.user.id,
        })),
      );
      if (mentionsError) throw mentionsError;
    }

    await Promise.all([
      supabaseClient.from("club_chat_reads").upsert(
        {
          club_id: clubId,
          user_id: authResult.user.id,
          last_read_message_id: message.id,
          read_at: message.created_at,
        },
        { onConflict: "club_id,user_id" },
      ),
      supabaseClient.from("club_chat_user_settings").upsert(
        {
          club_id: clubId,
          user_id: authResult.user.id,
          last_opened_at: new Date().toISOString(),
        },
        { onConflict: "club_id,user_id" },
      ),
      supabaseClient
        .from("book_clubs")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", clubId),
    ]);

    const [enriched] = await enrichClubChatMessages(supabaseClient, [message], authResult.user.id);
    return jsonResponse({ message: enriched }, 201, origin);
  } catch (error) {
    console.error("send-club-chat-message failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to send club message" },
      500,
      origin,
    );
  }
});
