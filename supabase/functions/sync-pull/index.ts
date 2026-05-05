import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

type CursorQuery<T> = T & {
  gt: (column: string, value: string) => T;
};

interface SyncPullBody {
  cursor?: unknown;
}

const applyCursor = <T>(query: CursorQuery<T>, column: string, cursor: string | null): T => {
  if (!cursor) return query;
  return query.gt(column, cursor);
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return optionsResponse(origin);
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "sync-pull",
      identifier: authResult.user.id,
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<SyncPullBody>(req);
    const cursor = typeof body.cursor === "string" && body.cursor ? body.cursor : null;
    const userId = authResult.user.id;
    const nextCursor = new Date().toISOString();

    const [
      booksResult,
      sessionsResult,
      progressResult,
      journalResult,
      goalsResult,
      profileResult,
    ] = await Promise.all([
      applyCursor(
        supabaseClient
          .from("books")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: true }),
        "updated_at",
        cursor
      ),
      applyCursor(
        supabaseClient
          .from("reading_sessions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        "created_at",
        cursor
      ),
      applyCursor(
        supabaseClient
          .from("progress_logs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true }),
        "created_at",
        cursor
      ),
      applyCursor(
        supabaseClient
          .from("journal_entries")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: true }),
        "updated_at",
        cursor
      ),
      applyCursor(
        supabaseClient
          .from("goals")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: true }),
        "updated_at",
        cursor
      ),
      applyCursor(
        supabaseClient
          .from("profiles")
          .select("id, color_theme, theme_mode, updated_at")
          .eq("id", userId),
        "updated_at",
        cursor
      ),
    ]);

    const error =
      booksResult.error ||
      sessionsResult.error ||
      progressResult.error ||
      journalResult.error ||
      goalsResult.error ||
      profileResult.error;

    if (error) throw error;

    return jsonResponse(
      {
        success: true,
        cursor: nextCursor,
        records: {
          books: booksResult.data ?? [],
          reading_sessions: sessionsResult.data ?? [],
          progress_logs: progressResult.data ?? [],
          journal_entries: journalResult.data ?? [],
          goals: goalsResult.data ?? [],
          profile_preferences: profileResult.data ?? [],
        },
      },
      200,
      origin
    );
  } catch (error) {
    console.error("sync-pull failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to pull sync changes" },
      500,
      origin
    );
  }
});
