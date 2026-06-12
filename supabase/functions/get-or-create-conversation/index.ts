import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { isPairBlocked } from "../_shared/messaging.ts";

interface GetOrCreateConversationBody {
  other_user_id?: unknown;
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
      name: "get-or-create-conversation",
      identifier: userId,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<GetOrCreateConversationBody>(req);
    const otherUserId = typeof body.other_user_id === "string" ? body.other_user_id.trim() : "";

    if (!otherUserId) return jsonResponse({ error: "other_user_id is required" }, 400, origin);
    if (otherUserId === userId) {
      return jsonResponse({ error: "You cannot message yourself" }, 400, origin);
    }

    const blocked = await isPairBlocked(supabaseClient, userId, otherUserId);
    if (blocked) return jsonResponse({ error: "Messaging is unavailable for this reader" }, 403, origin);

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("id", otherUserId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return jsonResponse({ error: "Reader not found" }, 404, origin);

    const { data: existing, error: existingError } = await supabaseClient
      .from("conversations")
      .select("id")
      .or(
        `and(participant_one_id.eq.${userId},participant_two_id.eq.${otherUserId}),and(participant_one_id.eq.${otherUserId},participant_two_id.eq.${userId})`
      )
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      await supabaseClient.from("conversation_user_settings").upsert(
        {
          conversation_id: existing.id,
          user_id: userId,
          hidden_at: null,
          is_archived: false,
        },
        { onConflict: "conversation_id,user_id" }
      );
      return jsonResponse({ conversation_id: existing.id }, 200, origin);
    }

    const [participantOneId, participantTwoId] = [userId, otherUserId].sort();
    const { data: created, error: createError } = await supabaseClient
      .from("conversations")
      .insert({
        participant_one_id: participantOneId,
        participant_two_id: participantTwoId,
      })
      .select("id")
      .single();

    if (createError) throw createError;
    return jsonResponse({ conversation_id: created.id }, 201, origin);
  } catch (error) {
    console.error("get-or-create-conversation failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to start conversation" },
      500,
      origin
    );
  }
});
