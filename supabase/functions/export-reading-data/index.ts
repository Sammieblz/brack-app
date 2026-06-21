import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);

  try {
    const client = createServiceClient();
    const auth = await getAuthenticatedUser(req, client, origin);
    if ("response" in auth) return auth.response;
    const limited = await enforceRateLimit(req, client, {
      name: "export-reading-data",
      identifier: auth.user.id,
      limit: 5,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const userId = auth.user.id;
    const [
      books,
      lists,
      listItems,
      progress,
      sessions,
      journals,
      goals,
      profile,
    ] = await Promise.all([
      client.from("books").select("*").eq("user_id", userId),
      client.from("book_lists").select("*").eq("user_id", userId),
      client.from("book_list_items").select("*").eq("user_id", userId),
      client.from("progress_logs").select("*").eq("user_id", userId),
      client.from("reading_sessions").select("*").eq("user_id", userId),
      client.from("journal_entries").select("*").eq("user_id", userId),
      client.from("goals").select("*").eq("user_id", userId),
      client
        .from("profiles")
        .select("id, color_theme, theme_mode, library_view_mode, updated_at")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const error =
      books.error ||
      lists.error ||
      listItems.error ||
      progress.error ||
      sessions.error ||
      journals.error ||
      goals.error ||
      profile.error;
    if (error) throw error;

    return jsonResponse(
      {
        success: true,
        format: "brack-reading-backup",
        version: 1,
        exported_at: new Date().toISOString(),
        data: {
          books: books.data ?? [],
          book_lists: lists.data ?? [],
          book_list_items: listItems.data ?? [],
          progress_logs: progress.data ?? [],
          reading_sessions: sessions.data ?? [],
          journal_entries: journals.data ?? [],
          goals: goals.data ?? [],
          preferences: profile.data ?? null,
        },
      },
      200,
      origin
    );
  } catch (error) {
    console.error("export-reading-data failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to export reading data" },
      500,
      origin
    );
  }
});
