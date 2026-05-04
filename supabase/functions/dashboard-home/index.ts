import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";

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

    const { data, error } = await supabaseClient.rpc("get_user_dashboard_stats", {
      p_user_id: authResult.user.id,
      p_recent_limit: recentLimit,
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
