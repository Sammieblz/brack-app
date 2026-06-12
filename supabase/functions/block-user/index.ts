import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { sanitizeString } from "../_shared/social.ts";

interface BlockUserBody {
  user_id?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "block-user",
      identifier: authResult.user.id,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<BlockUserBody>(req);
    const blockedId = sanitizeString(body.user_id, 80);
    if (!blockedId) return jsonResponse({ error: "user_id is required" }, 400, origin);
    if (blockedId === authResult.user.id) {
      return jsonResponse({ error: "You cannot block yourself" }, 400, origin);
    }

    const { error } = await supabaseClient.from("user_blocks").upsert(
      {
        blocker_id: authResult.user.id,
        blocked_id: blockedId,
      },
      { onConflict: "blocker_id,blocked_id" }
    );
    if (error) throw error;

    return jsonResponse({ blocked: true, user_id: blockedId }, 200, origin);
  } catch (error) {
    console.error("block-user failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to block user" },
      500,
      origin
    );
  }
});
