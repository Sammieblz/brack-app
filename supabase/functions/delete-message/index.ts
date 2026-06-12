import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface DeleteMessageBody {
  message_id?: unknown;
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
      name: "delete-message",
      identifier: userId,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<DeleteMessageBody>(req);
    const messageId = typeof body.message_id === "string" ? body.message_id.trim() : "";
    if (!messageId) return jsonResponse({ error: "message_id is required" }, 400, origin);

    const { data: message, error: lookupError } = await supabaseClient
      .from("messages")
      .select("id,sender_id")
      .eq("id", messageId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!message) return jsonResponse({ error: "Message not found" }, 404, origin);
    if (message.sender_id !== userId) {
      return jsonResponse({ error: "Only the sender can delete this message" }, 403, origin);
    }

    const { error } = await supabaseClient
      .from("messages")
      .update({
        content: null,
        deleted_at: new Date().toISOString(),
        metadata: { deleted_by_sender: true },
      })
      .eq("id", messageId);
    if (error) throw error;

    return jsonResponse({ success: true }, 200, origin);
  } catch (error) {
    console.error("delete-message failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to delete message" },
      500,
      origin
    );
  }
});
