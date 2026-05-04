import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";

interface AwardBadgesBody {
  event?: unknown;
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

    let event: string | null = null;
    if (req.method !== "GET") {
      const body = await parseJsonBody<AwardBadgesBody>(req);
      event = typeof body.event === "string" ? body.event : null;
    } else {
      const url = new URL(req.url);
      event = url.searchParams.get("event");
    }

    const { data, error } = await supabaseClient.rpc("award_badges", {
      p_user_id: authResult.user.id,
      p_event: event,
    });

    if (error) throw error;

    return jsonResponse(data ?? { success: true, awarded_badges: [] }, 200, origin);
  } catch (error) {
    console.error("award-badges failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to award badges",
      },
      500,
      origin
    );
  }
});
