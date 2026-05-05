import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface CompleteReadingBody {
  book_id?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  duration_minutes?: unknown;
  client_session_id?: unknown;
  page_number?: unknown;
  chapter_number?: unknown;
  paragraph_number?: unknown;
  notes?: unknown;
  log_type?: unknown;
  time_spent_minutes?: unknown;
  photo_url?: unknown;
  client_log_id?: unknown;
  mark_complete?: unknown;
}

const optionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const optionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

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
      name: "complete-reading",
      identifier: authResult.user.id,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<CompleteReadingBody>(req);
    const bookId = optionalString(body.book_id);
    if (!bookId) {
      return jsonResponse({ error: "book_id is required" }, 400, origin);
    }

    const durationMinutes = optionalNumber(body.duration_minutes);
    const pageNumber = optionalNumber(body.page_number);
    const chapterNumber = optionalNumber(body.chapter_number);
    const paragraphNumber = optionalNumber(body.paragraph_number);
    const timeSpentMinutes = optionalNumber(body.time_spent_minutes);
    const hasSessionInput = Boolean(body.start_time || body.end_time || durationMinutes);

    if (
      hasSessionInput &&
      (!optionalString(body.start_time) || !optionalString(body.end_time) || !durationMinutes)
    ) {
      return jsonResponse(
        { error: "start_time, end_time, and duration_minutes are required together" },
        400,
        origin
      );
    }

    if (pageNumber !== null && pageNumber < 1) {
      return jsonResponse({ error: "page_number must be at least 1" }, 400, origin);
    }

    const { data, error } = await supabaseClient.rpc("complete_reading_transaction", {
      p_user_id: authResult.user.id,
      p_book_id: bookId,
      p_start_time: optionalString(body.start_time),
      p_end_time: optionalString(body.end_time),
      p_duration_minutes: durationMinutes,
      p_client_session_id: optionalString(body.client_session_id),
      p_page_number: pageNumber,
      p_chapter_number: chapterNumber,
      p_paragraph_number: paragraphNumber,
      p_notes: optionalString(body.notes),
      p_log_type: optionalString(body.log_type) ?? "manual",
      p_time_spent_minutes: timeSpentMinutes,
      p_photo_url: optionalString(body.photo_url),
      p_client_log_id: optionalString(body.client_log_id),
      p_mark_complete: body.mark_complete === true,
    });

    if (error) throw error;

    return jsonResponse(data ?? { success: true }, 200, origin);
  } catch (error) {
    console.error("complete-reading failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to complete reading activity",
      },
      500,
      origin
    );
  }
});
