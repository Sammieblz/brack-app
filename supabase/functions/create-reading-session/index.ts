import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface CreateReadingSessionBody {
  book_id?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  duration_minutes?: unknown;
  client_session_id?: unknown;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return optionsResponse(origin);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "create-reading-session",
      identifier: authResult.user.id,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<CreateReadingSessionBody>(req);
    const bookId = typeof body.book_id === "string" ? body.book_id : "";
    const startTime = typeof body.start_time === "string" ? body.start_time : "";
    const endTime = typeof body.end_time === "string" ? body.end_time : "";
    const durationMinutes = Number(body.duration_minutes);
    const clientSessionId =
      typeof body.client_session_id === "string" && body.client_session_id.trim()
        ? body.client_session_id.trim()
        : null;

    if (!bookId || !startTime || !endTime || !Number.isFinite(durationMinutes) || durationMinutes < 1) {
      return jsonResponse(
        { error: "book_id, start_time, end_time, and duration_minutes are required" },
        400,
        origin
      );
    }

    const { data, error } = await supabaseClient.rpc("create_reading_session", {
      p_user_id: authResult.user.id,
      p_book_id: bookId,
      p_start_time: startTime,
      p_end_time: endTime,
      p_duration_minutes: Math.round(durationMinutes),
      p_client_session_id: clientSessionId,
    });

    if (error) throw error;

    return jsonResponse(data ?? { success: true }, 200, origin);
  } catch (error) {
    console.error("create-reading-session failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to create reading session",
      },
      500,
      origin
    );
  }
});
