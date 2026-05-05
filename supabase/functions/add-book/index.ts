import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

type AddBookBody = Record<string, unknown>;

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
      name: "add-book",
      identifier: authResult.user.id,
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<AddBookBody>(req);
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (!title) {
      return jsonResponse({ error: "Book title is required" }, 400, origin);
    }

    const { data, error } = await supabaseClient.rpc("add_library_book", {
      p_user_id: authResult.user.id,
      p_book: body,
    });

    if (error) throw error;

    const result = (data ?? {}) as Record<string, unknown>;
    if (result.code === "book_exists") {
      return jsonResponse(
        {
          code: "book_exists",
          message: "Book already exists in your library",
          book_id: result.book_id,
          book: result.book,
        },
        409,
        origin
      );
    }

    return jsonResponse(result, 200, origin);
  } catch (error) {
    console.error("add-book failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Failed to add book",
      },
      500,
      origin
    );
  }
});
