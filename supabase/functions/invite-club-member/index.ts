import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { sanitizeString } from "../_shared/social.ts";
import { isBlockedRelation, requireClubRole } from "../_shared/clubs.ts";

interface InviteMemberBody {
  clubId?: unknown;
  invitedUserId?: unknown;
  message?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "invite-club-member",
      identifier: authResult.user.id,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<InviteMemberBody>(req);
    const clubId = typeof body.clubId === "string" ? body.clubId : "";
    const invitedUserId = typeof body.invitedUserId === "string" ? body.invitedUserId : "";
    if (!clubId || !invitedUserId) {
      return jsonResponse({ error: "Club id and invited user are required" }, 400, origin);
    }
    if (invitedUserId === authResult.user.id) {
      return jsonResponse({ error: "You are already in this club" }, 400, origin);
    }

    await requireClubRole(supabaseClient, clubId, authResult.user.id, ["admin"]);
    if (await isBlockedRelation(supabaseClient, authResult.user.id, invitedUserId)) {
      return jsonResponse({ error: "This reader cannot be invited" }, 403, origin);
    }

    const { data: existingMember, error: existingMemberError } = await supabaseClient
      .from("book_club_members")
      .select("id")
      .eq("club_id", clubId)
      .eq("user_id", invitedUserId)
      .maybeSingle();
    if (existingMemberError) throw existingMemberError;
    if (existingMember) return jsonResponse({ error: "Reader is already a member" }, 409, origin);

    const { data, error } = await supabaseClient
      .from("book_club_invites")
      .insert({
        club_id: clubId,
        invited_user_id: invitedUserId,
        invited_by: authResult.user.id,
        message: sanitizeString(body.message, 500) || null,
        status: "pending",
        expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      })
      .select("id,club_id,invited_user_id,invited_by,status,message,expires_at,created_at,updated_at")
      .single();
    if (error?.code === "23505") {
      const { data: existing, error: existingError } = await supabaseClient
        .from("book_club_invites")
        .select("id,club_id,invited_user_id,invited_by,status,message,expires_at,created_at,updated_at")
        .eq("club_id", clubId)
        .eq("invited_user_id", invitedUserId)
        .eq("status", "pending")
        .maybeSingle();
      if (existingError) throw existingError;
      return jsonResponse({ ok: true, invite: existing }, 200, origin);
    }
    if (error) throw error;

    return jsonResponse({ ok: true, invite: data }, 200, origin);
  } catch (error) {
    console.error("invite-club-member failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to invite reader" },
      500,
      origin,
    );
  }
});
