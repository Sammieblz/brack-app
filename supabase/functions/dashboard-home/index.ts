import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface DashboardHomeBody {
  recent_limit?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return optionsResponse(origin);
  }

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "dashboard-home",
      identifier: authResult.user.id,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const url = new URL(req.url);
    const body = req.method === "GET" ? {} : await parseJsonBody<DashboardHomeBody>(req);
    const requestedLimit = Number.parseInt(
      url.searchParams.get("recent_limit") ||
        String(body.recent_limit || "") ||
        "10",
      10
    );
    const recentLimit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 30)
      : 10;

    const { data, error } = await supabaseClient.rpc("get_dashboard_home_snapshot", {
      p_user_id: authResult.user.id,
      p_recent_limit: recentLimit,
      p_max_age_seconds: 300,
    });

    if (error) throw error;

    return jsonResponse(data ?? {}, 200, origin);
  } catch (error) {
    console.error("dashboard-home failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to load dashboard home",
      },
      500,
      origin
    );
  }
});
