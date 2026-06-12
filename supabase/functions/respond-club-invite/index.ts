import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface RespondInviteBody {
  inviteId?: unknown;
  decision?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "respond-club-invite",
      identifier: authResult.user.id,
      limit: 80,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<RespondInviteBody>(req);
    const inviteId = typeof body.inviteId === "string" ? body.inviteId : "";
    const decision = body.decision === "accept" ? "accepted" : body.decision === "decline" ? "declined" : "";
    if (!inviteId || !decision) {
      return jsonResponse({ error: "Invite id and decision are required" }, 400, origin);
    }

    const { data: invite, error: inviteError } = await supabaseClient
      .from("book_club_invites")
      .select("id,club_id,invited_user_id,status,expires_at")
      .eq("id", inviteId)
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (!invite || invite.invited_user_id !== authResult.user.id) {
      return jsonResponse({ error: "Invite not found" }, 404, origin);
    }
    if (invite.status !== "pending") {
      return jsonResponse({ error: "This invite has already been answered" }, 409, origin);
    }
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      await supabaseClient
        .from("book_club_invites")
        .update({ status: "expired", responded_at: new Date().toISOString() })
        .eq("id", invite.id);
      return jsonResponse({ error: "This invite has expired" }, 409, origin);
    }

    const { error: updateError } = await supabaseClient
      .from("book_club_invites")
      .update({ status: decision, responded_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (updateError) throw updateError;

    if (decision === "accepted") {
      const { error: memberError } = await supabaseClient.from("book_club_members").upsert(
        {
          club_id: invite.club_id,
          user_id: authResult.user.id,
          role: "member",
        },
        { onConflict: "club_id,user_id" },
      );
      if (memberError) throw memberError;
    }

    return jsonResponse({ ok: true, status: decision }, 200, origin);
  } catch (error) {
    console.error("respond-club-invite failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to respond to invite" },
      500,
      origin,
    );
  }
});

