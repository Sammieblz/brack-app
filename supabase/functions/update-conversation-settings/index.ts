import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { requireConversationAccess } from "../_shared/messaging.ts";

interface UpdateConversationSettingsBody {
  conversation_id?: unknown;
  is_muted?: unknown;
  is_pinned?: unknown;
  is_archived?: unknown;
  hidden?: unknown;
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
      name: "update-conversation-settings",
      identifier: userId,
      limit: 90,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<UpdateConversationSettingsBody>(req);
    const conversationId =
      typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";

    if (!conversationId) {
      return jsonResponse({ error: "conversation_id is required" }, 400, origin);
    }

    const access = await requireConversationAccess(supabaseClient, conversationId, userId);
    if ("error" in access) return jsonResponse({ error: access.error }, access.status, origin);

    const payload: Record<string, unknown> = {
      conversation_id: conversationId,
      user_id: userId,
    };

    if (typeof body.is_muted === "boolean") payload.is_muted = body.is_muted;
    if (typeof body.is_pinned === "boolean") payload.is_pinned = body.is_pinned;
    if (typeof body.is_archived === "boolean") payload.is_archived = body.is_archived;
    if (typeof body.hidden === "boolean") {
      payload.hidden_at = body.hidden ? new Date().toISOString() : null;
    }

    const { data, error } = await supabaseClient
      .from("conversation_user_settings")
      .upsert(payload, { onConflict: "conversation_id,user_id" })
      .select("*")
      .single();

    if (error) throw error;
    return jsonResponse({ settings: data }, 200, origin);
  } catch (error) {
    console.error("update-conversation-settings failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to update conversation" },
      500,
      origin
    );
  }
});
