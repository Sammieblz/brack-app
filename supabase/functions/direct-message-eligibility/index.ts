import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import {
  getDirectMessageEligibility,
  sanitizeString,
} from "../_shared/messaging.ts";

interface DirectMessageEligibilityBody {
  other_user_id?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const userId = authResult.user.id;
    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "direct-message-eligibility",
      identifier: userId,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<DirectMessageEligibilityBody>(req);
    const otherUserId = sanitizeString(body.other_user_id, 80);
    if (!otherUserId) {
      return jsonResponse({ error: "other_user_id is required" }, 400, origin);
    }

    const status = await getDirectMessageEligibility(
      supabaseClient,
      userId,
      otherUserId
    );
    return jsonResponse({
      can_message: status === "eligible",
      status,
    }, 200, origin);
  } catch (error) {
    console.error("direct-message-eligibility failed", error);
    return jsonResponse(
      { error: "Unable to check messaging availability" },
      500,
      origin
    );
  }
});
