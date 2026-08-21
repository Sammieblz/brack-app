import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { sendFcmNotifications, type FcmNotification } from "../_shared/fcm.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface PushBody {
  user_ids?: unknown;
  notification?: FcmNotification;
  platform?: unknown;
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
      name: "send-push-notification",
      identifier: auth.user.id,
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<PushBody>(req);
    const userIds = Array.isArray(body.user_ids)
      ? [...new Set(body.user_ids.filter((id): id is string => typeof id === "string"))]
      : [];
    if (userIds.length !== 1 || userIds[0] !== auth.user.id) {
      return jsonResponse(
        { error: "Push notifications can only target the authenticated user" },
        403,
        origin,
      );
    }
    if (!body.notification?.title || !body.notification.body) {
      return jsonResponse({ error: "notification title and body are required" }, 400, origin);
    }

    let tokenQuery = client
      .from("push_tokens")
      .select("token")
      .eq("user_id", auth.user.id);
    if (typeof body.platform === "string") tokenQuery = tokenQuery.eq("platform", body.platform);
    const { data: tokens, error } = await tokenQuery;
    if (error) throw error;

    const results = await sendFcmNotifications(
      (tokens || []).map((token) => token.token),
      body.notification,
    );
    return jsonResponse({ success: true, results }, 200, origin);
  } catch (error) {
    console.error("send-push-notification failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Push delivery failed" },
      500,
      origin,
    );
  }
});
