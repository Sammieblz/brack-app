import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { getClubOr404, getClubRoles, isBlockedRelation } from "../_shared/clubs.ts";

interface JoinClubBody {
  clubId?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "join-club",
      identifier: authResult.user.id,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<JoinClubBody>(req);
    const clubId = typeof body.clubId === "string" ? body.clubId : "";
    if (!clubId) return jsonResponse({ error: "Club id is required" }, 400, origin);

    const club = await getClubOr404(supabaseClient, clubId);
    if (await isBlockedRelation(supabaseClient, authResult.user.id, club.created_by)) {
      return jsonResponse({ error: "Club not found" }, 404, origin);
    }

    const roles = await getClubRoles(supabaseClient, authResult.user.id, [clubId]);
    if (roles.has(clubId)) return jsonResponse({ ok: true, status: "member" }, 200, origin);
    if (club.is_private) {
      return jsonResponse({ error: "Private clubs require a join request or invite" }, 403, origin);
    }
    if (club.member_limit && (club.member_count || 0) >= club.member_limit) {
      return jsonResponse({ error: "This club is full" }, 409, origin);
    }

    const { error } = await supabaseClient.from("book_club_members").insert({
      club_id: clubId,
      user_id: authResult.user.id,
      role: "member",
    });
    if (error && error.code !== "23505") throw error;

    return jsonResponse({ ok: true, status: "member" }, 200, origin);
  } catch (error) {
    console.error("join-club failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to join club" },
      500,
      origin,
    );
  }
});

