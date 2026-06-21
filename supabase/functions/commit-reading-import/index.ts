import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface CommitBody {
  import_id?: string;
  batch_size?: number;
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
      name: "commit-reading-import",
      identifier: auth.user.id,
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<CommitBody>(req);
    if (!body.import_id) return jsonResponse({ error: "import_id is required" }, 400, origin);
    const batchSize = Math.min(Math.max(Number(body.batch_size) || 100, 1), 250);

    const { data: job, error } = await client
      .from("reading_import_jobs")
      .select("*")
      .eq("id", body.import_id)
      .eq("user_id", auth.user.id)
      .single();
    if (error) throw error;

    const previewBooks = Array.isArray(job.preview?.books) ? job.preview.books : [];
    const start = Number(job.processed_items || 0);
    const batch = previewBooks.slice(start, start + batchSize);
    let created = Number(job.result?.created || 0);
    let merged = Number(job.result?.merged || 0);
    let skipped = Number(job.result?.skipped || 0);
    const errors = Array.isArray(job.result?.errors) ? [...job.result.errors] : [];

    await client
      .from("reading_import_jobs")
      .update({ status: "processing", last_error: null })
      .eq("id", job.id)
      .eq("user_id", auth.user.id);

    for (const item of batch) {
      if (item.action === "invalid" || item.action === "skip") {
        skipped += 1;
        continue;
      }
      try {
        const { data, error: addError } = await client.rpc("add_library_book", {
          p_user_id: auth.user.id,
          p_book: item.book,
        });
        if (addError) throw addError;
        if (data?.code === "book_exists") merged += 1;
        else created += 1;
      } catch (itemError) {
        errors.push({
          row: Number(item.source_index) + 1,
          code: "book_import_failed",
          message: itemError instanceof Error ? itemError.message : "Book import failed",
        });
      }
    }

    const processedItems = start + batch.length;
    const complete = processedItems >= previewBooks.length;
    const result = {
      import_id: job.id,
      created,
      merged,
      skipped,
      failed: errors.length,
      errors,
    };
    const { error: updateError } = await client
      .from("reading_import_jobs")
      .update({
        status: complete ? "completed" : "processing",
        processed_items: processedItems,
        result,
        completed_at: complete ? new Date().toISOString() : null,
      })
      .eq("id", job.id)
      .eq("user_id", auth.user.id);
    if (updateError) throw updateError;

    return jsonResponse(
      {
        success: true,
        complete,
        processed_items: processedItems,
        total_items: previewBooks.length,
        result,
      },
      200,
      origin
    );
  } catch (error) {
    console.error("commit-reading-import failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to commit import" },
      500,
      origin
    );
  }
});
