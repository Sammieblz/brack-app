import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  try {
    const client = createServiceClient();
    const auth = await getAuthenticatedUser(req, client, origin);
    if ("response" in auth) return auth.response;

    const limited = await enforceRateLimit(req, client, {
      name: "gamification-home",
      identifier: auth.user.id,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const { data, error } = await client.rpc("get_gamification_home", {
      p_user_id: auth.user.id,
    });
    if (error) throw error;

    return jsonResponse(data ?? {}, 200, origin);
  } catch (error) {
    console.error("gamification-home failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load Reader Journey" },
      500,
      origin,
    );
  }
});
