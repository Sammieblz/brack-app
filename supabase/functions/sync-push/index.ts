import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

interface OutboxItem {
  id: string;
  client_mutation_id: string;
  client_entity_id: string;
  user_id: string;
  entity: string;
  operation: string;
  payload: Record<string, unknown>;
}

interface SyncPushBody {
  items?: unknown;
}

const omitKeys = (payload: Record<string, unknown>, keys: string[]) => {
  const next = { ...payload };
  for (const key of keys) delete next[key];
  return next;
};

const asString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const asNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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

    const body = await parseJsonBody<SyncPushBody>(req);
    const items = Array.isArray(body.items) ? (body.items as OutboxItem[]) : [];
    const userId = authResult.user.id;
    const accepted: Record<string, unknown>[] = [];
    const failed: Record<string, unknown>[] = [];

    for (const item of items) {
      try {
        if (item.user_id !== userId) {
          throw new Error("Outbox item does not belong to the authenticated user");
        }

        const result = await processItem(supabaseClient, userId, item);
        accepted.push({
          id: item.id,
          client_mutation_id: item.client_mutation_id,
          entity: item.entity,
          client_entity_id: item.client_entity_id,
          server_entity_id: result.server_entity_id,
          record: result.record,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync item failed";
        failed.push({
          id: item.id,
          client_mutation_id: item.client_mutation_id,
          entity: item.entity,
          client_entity_id: item.client_entity_id,
          error: message,
          retryable: !message.toLowerCase().includes("already exists"),
        });
      }
    }

    return jsonResponse(
      {
        success: failed.length === 0,
        accepted,
        failed,
        cursor: new Date().toISOString(),
      },
      200,
      origin
    );
  } catch (error) {
    console.error("sync-push failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to push sync changes" },
      500,
      origin
    );
  }
});

const processItem = async (
  supabaseClient: SupabaseClient,
  userId: string,
  item: OutboxItem
): Promise<{ server_entity_id?: string; record?: unknown }> => {
  switch (item.entity) {
    case "books":
      return processBook(supabaseClient, userId, item);
    case "reading_sessions":
      return processReadingSession(supabaseClient, userId, item);
    case "progress_logs":
      return processProgressLog(supabaseClient, userId, item);
    case "journal_entries":
      return processJournalEntry(supabaseClient, userId, item);
    case "goals":
      return processGoal(supabaseClient, userId, item);
    case "profile_preferences":
      return processProfilePreferences(supabaseClient, userId, item);
    default:
      throw new Error(`Unsupported sync entity: ${item.entity}`);
  }
};

const processBook = async (supabaseClient: SupabaseClient, userId: string, item: OutboxItem) => {
  if (item.operation === "create" || item.operation === "restore") {
    const { data, error } = await supabaseClient.rpc("add_library_book", {
      p_user_id: userId,
      p_book: { ...item.payload, id: item.payload.id || item.client_entity_id, user_id: userId },
    });
    if (error) throw error;
    if (data?.code === "book_exists") throw new Error("Book already exists in your library");
    return { server_entity_id: data?.book_id, record: data?.book };
  }

  if (item.operation === "delete") {
    const { data, error } = await supabaseClient
      .from("books")
      .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", item.client_entity_id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return { server_entity_id: data.id, record: data };
  }

  const updates = omitKeys(item.payload, ["id", "user_id", "created_at"]);
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from("books")
    .update(updates)
    .eq("id", item.client_entity_id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return { server_entity_id: data.id, record: data };
};

const processReadingSession = async (supabaseClient: SupabaseClient, userId: string, item: OutboxItem) => {
  const payload = item.payload;
  const { data, error } = await supabaseClient.rpc("create_reading_session", {
    p_user_id: userId,
    p_book_id: payload.book_id,
    p_start_time: payload.start_time,
    p_end_time: payload.end_time,
    p_duration_minutes: asNumber(payload.duration) ?? asNumber(payload.duration_minutes),
    p_client_session_id: asString(payload.client_session_id) || item.client_entity_id,
  });

  if (error) throw error;
  return { server_entity_id: data?.session?.id, record: data?.session };
};

const processProgressLog = async (supabaseClient: SupabaseClient, userId: string, item: OutboxItem) => {
  const payload = item.payload;
  const { data, error } = await supabaseClient.rpc("log_progress_transaction", {
    p_user_id: userId,
    p_book_id: payload.book_id,
    p_page_number: payload.page_number,
    p_chapter_number: payload.chapter_number ?? null,
    p_paragraph_number: payload.paragraph_number ?? null,
    p_notes: payload.notes ?? null,
    p_log_type: payload.log_type || "manual",
    p_time_spent_minutes: payload.time_spent_minutes ?? null,
    p_photo_url: payload.photo_url ?? null,
    p_client_log_id: asString(payload.client_log_id) || asString(payload.id) || item.client_mutation_id,
  });
  if (error) throw error;

  const { data: log, error: fetchError } = await supabaseClient
    .from("progress_logs")
    .select("*")
    .eq("id", data.log_id)
    .single();
  if (fetchError) throw fetchError;
  return { server_entity_id: log.id, record: log };
};

const processJournalEntry = async (supabaseClient: SupabaseClient, userId: string, item: OutboxItem) => {
  if (item.operation === "delete") {
    const { error } = await supabaseClient
      .from("journal_entries")
      .delete()
      .eq("id", item.client_entity_id)
      .eq("user_id", userId);
    if (error) throw error;
    return { server_entity_id: item.client_entity_id, record: { id: item.client_entity_id, deleted_at: new Date().toISOString() } };
  }

  if (item.operation === "create" || item.operation === "restore") {
    const payload = { ...item.payload, id: item.payload.id || item.client_entity_id, user_id: userId };
    const { data, error } = await supabaseClient
      .from("journal_entries")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return { server_entity_id: data.id, record: data };
  }

  const updates = omitKeys(item.payload, ["id", "user_id", "created_at"]);
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from("journal_entries")
    .update(updates)
    .eq("id", item.client_entity_id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return { server_entity_id: data.id, record: data };
};

const processGoal = async (supabaseClient: SupabaseClient, userId: string, item: OutboxItem) => {
  if (item.operation === "delete") {
    const { error } = await supabaseClient
      .from("goals")
      .delete()
      .eq("id", item.client_entity_id)
      .eq("user_id", userId);
    if (error) throw error;
    return { server_entity_id: item.client_entity_id, record: { id: item.client_entity_id, deleted_at: new Date().toISOString() } };
  }

  if (item.operation === "create" || item.operation === "restore") {
    const payload = { ...item.payload, id: item.payload.id || item.client_entity_id, user_id: userId };
    const { data, error } = await supabaseClient
      .from("goals")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return { server_entity_id: data.id, record: data };
  }

  const updates = omitKeys(item.payload, ["id", "user_id", "created_at"]);
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from("goals")
    .update(updates)
    .eq("id", item.client_entity_id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return { server_entity_id: data.id, record: data };
};

const processProfilePreferences = async (supabaseClient: SupabaseClient, userId: string, item: OutboxItem) => {
  const updates = omitKeys(item.payload, ["id", "user_id", "created_at"]);
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabaseClient
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("id, color_theme, theme_mode, updated_at")
    .single();
  if (error) throw error;
  return { server_entity_id: data.id, record: data };
};
