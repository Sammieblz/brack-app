import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { requireConversationAccess } from "../_shared/messaging.ts";

interface MarkConversationReadBody {
  conversation_id?: unknown;
  last_read_message_id?: unknown;
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
      name: "mark-conversation-read",
      identifier: userId,
      limit: 180,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<MarkConversationReadBody>(req);
    const conversationId =
      typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";
    const lastReadMessageId =
      typeof body.last_read_message_id === "string" && body.last_read_message_id.trim()
        ? body.last_read_message_id.trim()
        : null;

    if (!conversationId) {
      return jsonResponse({ error: "conversation_id is required" }, 400, origin);
    }

    const access = await requireConversationAccess(supabaseClient, conversationId, userId);
    if ("error" in access) return jsonResponse({ error: access.error }, access.status, origin);

    const readAt = new Date().toISOString();

    const { error: readError } = await supabaseClient.from("conversation_reads").upsert(
      {
        conversation_id: conversationId,
        user_id: userId,
        last_read_message_id: lastReadMessageId,
        read_at: readAt,
      },
      { onConflict: "conversation_id,user_id" }
    );
    if (readError) throw readError;

    const { error: legacyError } = await supabaseClient
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", userId)
      .eq("is_read", false);
    if (legacyError) throw legacyError;

    return jsonResponse({ read_at: readAt }, 200, origin);
  } catch (error) {
    console.error("mark-conversation-read failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to mark conversation read" },
      500,
      origin
    );
  }
});
