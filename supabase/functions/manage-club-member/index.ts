import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { requireClubRole, type ClubRole } from "../_shared/clubs.ts";

interface ManageMemberBody {
  clubId?: unknown;
  targetUserId?: unknown;
  action?: unknown;
  role?: unknown;
}

const assertNotLastAdmin = async (
  supabaseClient: ReturnType<typeof createServiceClient>,
  clubId: string,
  targetUserId: string,
) => {
  const { data: target, error: targetError } = await supabaseClient
    .from("book_club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (targetError) throw targetError;
  if (target?.role !== "admin") return;

  const { count, error: countError } = await supabaseClient
    .from("book_club_members")
    .select("*", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("role", "admin");
  if (countError) throw countError;
  if ((count || 0) <= 1) throw new Error("This club needs at least one admin");
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "manage-club-member",
      identifier: authResult.user.id,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<ManageMemberBody>(req);
    const clubId = typeof body.clubId === "string" ? body.clubId : "";
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
    const action = body.action === "remove" ? "remove" : body.action === "set_role" ? "set_role" : "";
    const role = body.role === "admin" || body.role === "moderator" || body.role === "member"
      ? body.role
      : "";
    if (!clubId || !targetUserId || !action) {
      return jsonResponse({ error: "Club id, target user, and action are required" }, 400, origin);
    }

    await requireClubRole(supabaseClient, clubId, authResult.user.id, ["admin"]);
    await assertNotLastAdmin(supabaseClient, clubId, targetUserId);

    if (action === "remove") {
      const { error } = await supabaseClient
        .from("book_club_members")
        .delete()
        .eq("club_id", clubId)
        .eq("user_id", targetUserId);
      if (error) throw error;
      return jsonResponse({ ok: true }, 200, origin);
    }

    if (!role) return jsonResponse({ error: "A valid role is required" }, 400, origin);
    const { data, error } = await supabaseClient
      .from("book_club_members")
      .update({ role: role as ClubRole })
      .eq("club_id", clubId)
      .eq("user_id", targetUserId)
      .select("id,club_id,user_id,role,joined_at")
      .single();
    if (error) throw error;

    return jsonResponse({ member: data }, 200, origin);
  } catch (error) {
    console.error("manage-club-member failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to manage member" },
      500,
      origin,
    );
  }
});

