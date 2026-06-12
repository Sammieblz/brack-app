import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { sanitizeString } from "../_shared/social.ts";

interface UpdatePresenceBody {
  reader_status?: unknown;
}

const VALID_STATUSES = new Set([
  "available",
  "reading_now",
  "buddy_reads",
  "looking_for_club",
  "taking_recommendations",
  "quiet",
]);

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "update-presence",
      identifier: authResult.user.id,
      limit: 90,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<UpdatePresenceBody>(req);
    const requestedStatus = sanitizeString(body.reader_status, 80);

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, show_online_status, reader_status, last_seen_at")
      .eq("id", authResult.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return jsonResponse({ error: "Profile not found" }, 404, origin);

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (requestedStatus) {
      if (!VALID_STATUSES.has(requestedStatus)) {
        return jsonResponse({ error: "Invalid reader status" }, 400, origin);
      }
      updates.reader_status = requestedStatus;
    }

    if (profile.show_online_status !== false) {
      updates.last_seen_at = new Date().toISOString();
    }

    if (Object.keys(updates).length > 1) {
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update(updates)
        .eq("id", authResult.user.id);
      if (updateError) throw updateError;
    }

    return jsonResponse(
      {
        online_enabled: profile.show_online_status !== false,
        reader_status: requestedStatus || profile.reader_status || "available",
        last_seen_at:
          profile.show_online_status !== false
            ? String(updates.last_seen_at)
            : profile.last_seen_at,
      },
      200,
      origin,
    );
  } catch (error) {
    console.error("update-presence failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to update presence" },
      500,
      origin,
    );
  }
});
