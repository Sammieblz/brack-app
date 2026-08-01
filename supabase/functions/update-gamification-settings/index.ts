import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface SettingsBody {
  leaderboard_opt_in?: unknown;
  gamification_profile_visible?: unknown;
  timezone?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);

  try {
    const client = createServiceClient();
    const auth = await getAuthenticatedUser(req, client, origin);
    if ("response" in auth) return auth.response;
    const limited = await enforceRateLimit(req, client, {
      name: "update-gamification-settings",
      identifier: auth.user.id,
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<SettingsBody>(req);
    const timezone = typeof body.timezone === "string" && body.timezone.trim()
      ? body.timezone.trim()
      : null;

    const { data, error } = await client.rpc("update_gamification_settings", {
      p_user_id: auth.user.id,
      p_leaderboard_opt_in:
        typeof body.leaderboard_opt_in === "boolean" ? body.leaderboard_opt_in : null,
      p_profile_visible:
        typeof body.gamification_profile_visible === "boolean"
          ? body.gamification_profile_visible
          : null,
      p_timezone: timezone,
    });
    if (error) {
      if (String(error.message).toLowerCase().includes("time zone")) {
        return jsonResponse({ error: "Invalid IANA timezone" }, 400, origin);
      }
      throw error;
    }
    return jsonResponse(data ?? { success: true }, 200, origin);
  } catch (error) {
    console.error("update-gamification-settings failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to update Journey settings" },
      500,
      origin,
    );
  }
});
