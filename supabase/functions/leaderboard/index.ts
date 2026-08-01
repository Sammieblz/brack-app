import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface LeaderboardBody {
  scope?: unknown;
  week_id?: unknown;
  limit?: unknown;
}

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
      name: "leaderboard",
      identifier: auth.user.id,
      limit: 90,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = req.method === "POST"
      ? await parseJsonBody<LeaderboardBody>(req)
      : Object.fromEntries(new URL(req.url).searchParams.entries());
    const requestedScope = typeof body.scope === "string" ? body.scope : "league";
    const scope = ["league", "friends", "global"].includes(requestedScope)
      ? requestedScope
      : "league";
    const weekId = typeof body.week_id === "string" && body.week_id ? body.week_id : null;
    const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 100);

    const { data, error } = await client.rpc("get_reader_leaderboard", {
      p_user_id: auth.user.id,
      p_scope: scope,
      p_week_id: weekId,
      p_limit: limit,
    });
    if (error) throw error;
    return jsonResponse(data ?? { entries: [], scope }, 200, origin);
  } catch (error) {
    console.error("leaderboard failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load rankings" },
      500,
      origin,
    );
  }
});
