import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface ImportBook {
  id?: string;
  title?: string;
  author?: string | null;
  isbn?: string | null;
  [key: string]: unknown;
}

interface PreviewBody {
  source_format?: string;
  source_hash?: string;
  payload?: {
    books?: ImportBook[];
    [key: string]: unknown;
  };
}

const normalize = (value: unknown) =>
  String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const normalizeIsbn = (value: unknown) =>
  String(value ?? "").toUpperCase().replace(/[^0-9X]/g, "") || null;

const digestPayload = async (payload: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, origin);

  try {
    const client = createServiceClient();
    const auth = await getAuthenticatedUser(req, client, origin);
    if ("response" in auth) return auth.response;
    const limited = await enforceRateLimit(req, client, {
      name: "preview-reading-import",
      identifier: auth.user.id,
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<PreviewBody>(req);
    const books = Array.isArray(body.payload?.books) ? body.payload.books : [];
    if (books.length > 10_000) {
      return jsonResponse({ error: "Import exceeds the 10,000 book limit" }, 413, origin);
    }

    const { data: existing, error } = await client
      .from("books")
      .select("id, title, author, isbn")
      .eq("user_id", auth.user.id)
      .is("deleted_at", null);
    if (error) throw error;

    const previewBooks = books.map((book, index) => {
      const isbn = normalizeIsbn(book.isbn);
      const titleAuthor = `${normalize(book.title)}|${normalize(book.author)}`;
      const match = (existing ?? []).find((candidate) => {
        const existingIsbn = normalizeIsbn(candidate.isbn);
        return isbn && existingIsbn
          ? isbn === existingIsbn
          : titleAuthor === `${normalize(candidate.title)}|${normalize(candidate.author)}`;
      });
      const invalid = !String(book.title || "").trim();
      return {
        source_index: index,
        action: invalid ? "invalid" : match ? "merge" : "create",
        existing_book_id: match?.id ?? null,
        book,
        warnings: invalid ? ["Book title is required"] : [],
      };
    });

    const sourceHash = body.source_hash || await digestPayload(body.payload);
    const preview = {
      source_format: body.source_format || "json",
      valid: previewBooks.filter((book) => book.action !== "invalid").length,
      duplicates: previewBooks.filter((book) => book.action === "merge").length,
      mergeable: previewBooks.filter((book) => book.action === "merge").length,
      skipped: 0,
      invalid: previewBooks.filter((book) => book.action === "invalid").length,
      issues: previewBooks
        .filter((book) => book.action === "invalid")
        .map((book) => ({
          row: book.source_index + 1,
          code: "missing_title",
          message: "Book title is required",
        })),
      books: previewBooks,
    };

    const { data: job, error: jobError } = await client
      .from("reading_import_jobs")
      .upsert(
        {
          user_id: auth.user.id,
          source_format: preview.source_format,
          source_hash: sourceHash,
          status: "previewed",
          preview,
          payload: body.payload ?? {},
          total_items: books.length,
          processed_items: 0,
          result: null,
          last_error: null,
          completed_at: null,
        },
        { onConflict: "user_id,source_hash" }
      )
      .select("id")
      .single();
    if (jobError) throw jobError;

    return jsonResponse({ success: true, import_id: job.id, ...preview }, 200, origin);
  } catch (error) {
    console.error("preview-reading-import failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to preview import" },
      500,
      origin
    );
  }
});
