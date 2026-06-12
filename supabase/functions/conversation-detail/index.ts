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
  requireConversationAccess,
} from "../_shared/messaging.ts";

interface ConversationDetailBody {
  conversation_id?: unknown;
  limit?: unknown;
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
      name: "conversation-detail",
      identifier: userId,
      limit: 180,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<ConversationDetailBody>(req);
    const conversationId =
      typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";
    const limit = Math.min(Math.max(Number(body.limit || 80), 1), 120);

    if (!conversationId) {
      return jsonResponse({ error: "conversation_id is required" }, 400, origin);
    }

    const access = await requireConversationAccess(supabaseClient, conversationId, userId);
    if ("error" in access) return jsonResponse({ error: access.error }, access.status, origin);

    const [blocked, profileResult, settingsResult, messagesResult] = await Promise.all([
      isPairBlocked(supabaseClient, userId, access.otherUserId),
      supabaseClient
        .from("profiles")
        .select("id,display_name,avatar_url,show_online_status,last_seen_at,reader_status")
        .eq("id", access.otherUserId)
        .maybeSingle(),
      supabaseClient
        .from("conversation_user_settings")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseClient
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (settingsResult.error) throw settingsResult.error;
    if (messagesResult.error) throw messagesResult.error;

    await supabaseClient.from("conversation_user_settings").upsert(
      {
        conversation_id: conversationId,
        user_id: userId,
        last_opened_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id,user_id" }
    );

    const messages = await enrichMessages(
      supabaseClient,
      [...(messagesResult.data || [])].reverse(),
      userId,
      !blocked
    );

    return jsonResponse(
      {
        conversation: access.conversation,
        other_user: profileResult.data || null,
        settings: settingsResult.data || null,
        messages,
        is_blocked: blocked,
      },
      200,
      origin
    );
  } catch (error) {
    console.error("conversation-detail failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load conversation" },
      500,
      origin
    );
  }
});
