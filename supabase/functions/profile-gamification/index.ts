import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface ProfileGamificationBody {
  user_id?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  try {
    const client = createServiceClient();
    const auth = await getAuthenticatedUser(req, client, origin);
    if ("response" in auth) return auth.response;

    const limited = await enforceRateLimit(req, client, {
      name: "profile-gamification",
      identifier: auth.user.id,
      limit: 90,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<ProfileGamificationBody>(req);
    const targetUserId =
      typeof body.user_id === "string" && body.user_id ? body.user_id : auth.user.id;

    const { data, error } = await client.rpc("get_public_gamification_profile", {
      p_viewer_id: auth.user.id,
      p_target_user_id: targetUserId,
    });
    if (error) throw error;

    return jsonResponse({ gamification: data ?? null }, 200, origin);
  } catch (error) {
    console.error("profile-gamification failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load Journey profile" },
      500,
      origin,
    );
  }
});
