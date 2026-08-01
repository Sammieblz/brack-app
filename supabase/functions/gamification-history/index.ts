import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface HistoryBody {
  before?: unknown;
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
      name: "gamification-history",
      identifier: auth.user.id,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = req.method === "POST"
      ? await parseJsonBody<HistoryBody>(req)
      : Object.fromEntries(new URL(req.url).searchParams.entries());
    const before = typeof body.before === "string" && body.before ? body.before : null;
    const limit = Math.min(Math.max(Number(body.limit) || 30, 1), 100);

    const { data, error } = await client.rpc("get_gamification_history", {
      p_user_id: auth.user.id,
      p_before: before,
      p_limit: limit,
    });
    if (error) throw error;
    return jsonResponse(data ?? { items: [] }, 200, origin);
  } catch (error) {
    console.error("gamification-history failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to load Ink history" },
      500,
      origin,
    );
  }
});
