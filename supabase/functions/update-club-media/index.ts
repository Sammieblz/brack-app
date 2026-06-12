import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  ACTIVE_CLUB_SELECT,
  getClubImageUrls,
  getViewerContext,
  normalizeClubPreview,
  requireClubRole,
  sanitizeClubMediaPath,
} from "../_shared/clubs.ts";

interface UpdateClubMediaBody {
  clubId?: unknown;
  banner_image_path?: unknown;
  avatar_image_path?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "update-club-media",
      identifier: authResult.user.id,
      limit: 40,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<UpdateClubMediaBody>(req);
    const clubId = typeof body.clubId === "string" ? body.clubId : "";
    if (!clubId) return jsonResponse({ error: "Club id is required" }, 400, origin);

    await requireClubRole(supabaseClient, clubId, authResult.user.id, ["admin"]);

    const updates: Record<string, string | null> = {};
    if ("banner_image_path" in body) {
      updates.banner_image_path = sanitizeClubMediaPath(body.banner_image_path, authResult.user.id);
    }
    if ("avatar_image_path" in body) {
      updates.avatar_image_path = sanitizeClubMediaPath(body.avatar_image_path, authResult.user.id);
    }
    if (Object.keys(updates).length === 0) {
      return jsonResponse({ error: "No media fields provided" }, 400, origin);
    }

    const { data, error } = await supabaseClient
      .from("book_clubs")
      .update(updates)
      .eq("id", clubId)
      .select(ACTIVE_CLUB_SELECT)
      .single();
    if (error) throw error;

    const viewer = await getViewerContext(supabaseClient, authResult.user.id);
    const imageUrls = await getClubImageUrls(supabaseClient, data);
    return jsonResponse(
      {
        club: normalizeClubPreview(data, viewer, "admin", {
          ...imageUrls,
          joinStatus: "member",
        }),
      },
      200,
      origin,
    );
  } catch (error) {
    console.error("update-club-media failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to update club media" },
      500,
      origin,
    );
  }
});
