import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { sanitizeString } from "../_shared/social.ts";
import {
  ACTIVE_CLUB_SELECT,
  getClubImageUrls,
  normalizeClubPreview,
  sanitizeClubMediaPath,
  sanitizeTextArray,
  getViewerContext,
} from "../_shared/clubs.ts";

interface CreateClubBody {
  name?: unknown;
  description?: unknown;
  is_private?: unknown;
  cover_image_url?: unknown;
  banner_image_path?: unknown;
  avatar_image_path?: unknown;
  current_book_id?: unknown;
  city?: unknown;
  country?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  genres?: unknown;
  tags?: unknown;
  member_limit?: unknown;
}

const optionalNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "create-club",
      identifier: authResult.user.id,
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<CreateClubBody>(req);
    const name = sanitizeString(body.name, 100);
    if (name.length < 2) {
      return jsonResponse({ error: "Club name must be at least 2 characters" }, 400, origin);
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("city,country,latitude,longitude,show_location")
      .eq("id", authResult.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const memberLimit = optionalNumber(body.member_limit);
    const bannerImagePath = sanitizeClubMediaPath(body.banner_image_path, authResult.user.id);
    const avatarImagePath = sanitizeClubMediaPath(body.avatar_image_path, authResult.user.id);
    const { data, error } = await supabaseClient
      .from("book_clubs")
      .insert({
        name,
        description: sanitizeString(body.description, 600) || null,
        is_private: Boolean(body.is_private),
        cover_image_url: sanitizeString(body.cover_image_url, 500) || null,
        banner_image_path: bannerImagePath,
        avatar_image_path: avatarImagePath,
        current_book_id:
          typeof body.current_book_id === "string" && body.current_book_id ? body.current_book_id : null,
        created_by: authResult.user.id,
        city: sanitizeString(body.city, 80) || profile?.city || null,
        country: sanitizeString(body.country, 80) || profile?.country || null,
        latitude: optionalNumber(body.latitude) ?? (profile?.show_location !== false ? profile?.latitude ?? null : null),
        longitude: optionalNumber(body.longitude) ?? (profile?.show_location !== false ? profile?.longitude ?? null : null),
        genres: sanitizeTextArray(body.genres),
        tags: sanitizeTextArray(body.tags, 12, 32),
        member_limit: memberLimit && memberLimit >= 2 ? memberLimit : null,
      })
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
      201,
      origin,
    );
  } catch (error) {
    console.error("create-club failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to create club" },
      500,
      origin,
    );
  }
});
