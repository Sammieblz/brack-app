import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

interface SyncPullBody {
  cursor?: unknown;
}

interface EntityCursor {
  timestamp: string;
  id: string;
}

interface SyncCursor {
  version: 1;
  entities: Record<string, EntityCursor | null>;
}

interface SyncDefinition {
  key: string;
  table: string;
  timestampColumn: string;
  select: string;
  userColumn: string;
}

const PAGE_SIZE = 250;
const CURSOR_VERSION = 1 as const;

const DEFINITIONS: SyncDefinition[] = [
  { key: "books", table: "books", timestampColumn: "updated_at", select: "*", userColumn: "user_id" },
  {
    key: "reading_sessions",
    table: "reading_sessions",
    timestampColumn: "created_at",
    select: "*",
    userColumn: "user_id",
  },
  {
    key: "progress_logs",
    table: "progress_logs",
    timestampColumn: "created_at",
    select: "*",
    userColumn: "user_id",
  },
  {
    key: "journal_entries",
    table: "journal_entries",
    timestampColumn: "updated_at",
    select: "*",
    userColumn: "user_id",
  },
  { key: "goals", table: "goals", timestampColumn: "updated_at", select: "*", userColumn: "user_id" },
  {
    key: "book_lists",
    table: "book_lists",
    timestampColumn: "updated_at",
    select: "*",
    userColumn: "user_id",
  },
  {
    key: "book_list_items",
    table: "book_list_items",
    timestampColumn: "updated_at",
    select: "*",
    userColumn: "user_id",
  },
  {
    key: "profile_preferences",
    table: "profiles",
    timestampColumn: "updated_at",
    select: "id, color_theme, theme_mode, library_view_mode, updated_at",
    userColumn: "id",
  },
];

const emptyCursor = (): SyncCursor => ({
  version: CURSOR_VERSION,
  entities: Object.fromEntries(DEFINITIONS.map((definition) => [definition.key, null])),
});

const decodeCursor = (value: unknown): SyncCursor => {
  if (typeof value !== "string" || !value) return emptyCursor();
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as Partial<SyncCursor>;
    if (parsed.version !== CURSOR_VERSION || !parsed.entities) return emptyCursor();
    return {
      version: CURSOR_VERSION,
      entities: {
        ...emptyCursor().entities,
        ...parsed.entities,
      },
    };
  } catch {
    return emptyCursor();
  }
};

const encodeCursor = (cursor: SyncCursor) =>
  btoa(JSON.stringify(cursor)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const escapeFilterValue = (value: string) =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

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
    const cursor = decodeCursor(body.cursor);
    const userId = authResult.user.id;
    const records: Record<string, Record<string, unknown>[]> = {};
    let hasMore = false;

    for (const definition of DEFINITIONS) {
      const entityCursor = cursor.entities[definition.key];
      let query = supabaseClient
        .from(definition.table)
        .select(definition.select)
        .eq(definition.userColumn, userId)
        .order(definition.timestampColumn, { ascending: true })
        .order("id", { ascending: true })
        .limit(PAGE_SIZE + 1);

      if (entityCursor) {
        const timestamp = escapeFilterValue(entityCursor.timestamp);
        const id = escapeFilterValue(entityCursor.id);
        query = query.or(
          `${definition.timestampColumn}.gt.${timestamp},and(${definition.timestampColumn}.eq.${timestamp},id.gt.${id})`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      const page = (data ?? []) as Record<string, unknown>[];
      if (page.length > PAGE_SIZE) hasMore = true;
      const acceptedPage = page.slice(0, PAGE_SIZE);
      records[definition.key] = acceptedPage;

      const last = acceptedPage.at(-1);
      if (last) {
        cursor.entities[definition.key] = {
          timestamp: String(last[definition.timestampColumn]),
          id: String(last.id),
        };
      }
    }

    return jsonResponse(
      {
        success: true,
        cursor: encodeCursor(cursor),
        has_more: hasMore,
        records,
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
