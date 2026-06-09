import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { sanitizeString } from "../_shared/social.ts";
import { getClubOr404, getClubRoles, isBlockedRelation } from "../_shared/clubs.ts";

interface RequestJoinBody {
  clubId?: unknown;
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
      name: "request-club-join",
      identifier: authResult.user.id,
      limit: 40,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<RequestJoinBody>(req);
    const clubId = typeof body.clubId === "string" ? body.clubId : "";
    if (!clubId) return jsonResponse({ error: "Club id is required" }, 400, origin);

    const club = await getClubOr404(supabaseClient, clubId);
    if (await isBlockedRelation(supabaseClient, authResult.user.id, club.created_by)) {
      return jsonResponse({ error: "Club not found" }, 404, origin);
    }

    const roles = await getClubRoles(supabaseClient, authResult.user.id, [clubId]);
    if (roles.has(clubId)) return jsonResponse({ ok: true, status: "member" }, 200, origin);
    if (!club.is_private) {
      return jsonResponse({ error: "Public clubs can be joined directly" }, 400, origin);
    }

    const { data, error } = await supabaseClient
      .from("book_club_join_requests")
      .insert({
        club_id: clubId,
        user_id: authResult.user.id,
        message: sanitizeString(body.message, 600) || null,
        status: "pending",
      })
      .select("id,club_id,user_id,message,status,created_at,updated_at")
      .single();
    if (error?.code === "23505") {
      const { data: existing, error: existingError } = await supabaseClient
        .from("book_club_join_requests")
        .select("id,club_id,user_id,message,status,created_at,updated_at")
        .eq("club_id", clubId)
        .eq("user_id", authResult.user.id)
        .eq("status", "pending")
        .maybeSingle();
      if (existingError) throw existingError;
      return jsonResponse({ ok: true, request: existing }, 200, origin);
    }
    if (error) throw error;

    return jsonResponse({ ok: true, request: data }, 200, origin);
  } catch (error) {
    console.error("request-club-join failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to request access" },
      500,
      origin,
    );
  }
});
