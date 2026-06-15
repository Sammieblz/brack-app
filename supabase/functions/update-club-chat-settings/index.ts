import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { requireClubMember } from "../_shared/clubChat.ts";

interface UpdateClubChatSettingsBody {
  club_id?: unknown;
  is_muted?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const body = await parseJsonBody<UpdateClubChatSettingsBody>(req);
    const clubId = typeof body.club_id === "string" ? body.club_id.trim() : "";
    if (!clubId) return jsonResponse({ error: "club_id is required" }, 400, origin);

    const membership = await requireClubMember(supabaseClient, clubId, authResult.user.id);
    if ("error" in membership) return jsonResponse({ error: membership.error }, membership.status, origin);

    const { data, error } = await supabaseClient
      .from("club_chat_user_settings")
      .upsert(
        {
          club_id: clubId,
          user_id: authResult.user.id,
          is_muted: body.is_muted === true,
          last_opened_at: new Date().toISOString(),
        },
        { onConflict: "club_id,user_id" },
      )
      .select("*")
      .single();
    if (error) throw error;

    return jsonResponse({ settings: data }, 200, origin);
  } catch (error) {
    console.error("update-club-chat-settings failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to update club chat settings" },
      500,
      origin,
    );
  }
});
