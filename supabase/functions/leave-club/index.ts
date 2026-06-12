import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface LeaveClubBody {
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
      name: "leave-club",
      identifier: authResult.user.id,
      limit: 40,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<LeaveClubBody>(req);
    const clubId = typeof body.clubId === "string" ? body.clubId : "";
    if (!clubId) return jsonResponse({ error: "Club id is required" }, 400, origin);

    const { data: membership, error: memberError } = await supabaseClient
      .from("book_club_members")
      .select("id,role")
      .eq("club_id", clubId)
      .eq("user_id", authResult.user.id)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!membership) return jsonResponse({ ok: true }, 200, origin);

    if (membership.role === "admin") {
      const { count, error: adminCountError } = await supabaseClient
        .from("book_club_members")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("role", "admin");
      if (adminCountError) throw adminCountError;
      if ((count || 0) <= 1) {
        return jsonResponse(
          { error: "Assign another admin before leaving this club" },
          409,
          origin,
        );
      }
    }

    const { error } = await supabaseClient
      .from("book_club_members")
      .delete()
      .eq("club_id", clubId)
      .eq("user_id", authResult.user.id);
    if (error) throw error;

    return jsonResponse({ ok: true }, 200, origin);
  } catch (error) {
    console.error("leave-club failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to leave club" },
      500,
      origin,
    );
  }
});

