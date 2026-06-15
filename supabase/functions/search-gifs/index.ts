import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { sanitizeString } from "../_shared/messaging.ts";

interface SearchGifsBody {
  query?: unknown;
  limit?: unknown;
  pos?: unknown;
}

interface TenorMediaFormat {
  url?: string;
  dims?: number[];
}

interface TenorResult {
  id: string;
  title?: string;
  content_description?: string;
  media_formats?: {
    gif?: TenorMediaFormat;
    tinygif?: TenorMediaFormat;
    nanogif?: TenorMediaFormat;
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "search-gifs",
      identifier: authResult.user.id,
      limit: 60,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const apiKey = Deno.env.get("TENOR_API_KEY");
    if (!apiKey) return jsonResponse({ error: "GIF search is not configured" }, 503, origin);

    const body = await parseJsonBody<SearchGifsBody>(req);
    const query = sanitizeString(body.query, 120);
    const limit = Math.min(Math.max(Number(body.limit || 18), 1), 24);
    const pos = sanitizeString(body.pos, 200);
    if (!query) return jsonResponse({ error: "query is required" }, 400, origin);

    const url = new URL("https://tenor.googleapis.com/v2/search");
    url.searchParams.set("q", query);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("client_key", "brack");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("media_filter", "gif,tinygif,nanogif");
    url.searchParams.set("contentfilter", "medium");
    if (pos) url.searchParams.set("pos", pos);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("Tenor API error", response.status, await response.text());
      return jsonResponse({ error: "Failed to search GIFs" }, response.status, origin);
    }

    const data = await response.json();
    const results = ((data.results || []) as TenorResult[])
      .map((item) => {
        const full = item.media_formats?.gif;
        const preview = item.media_formats?.tinygif || item.media_formats?.nanogif || full;
        if (!full?.url || !preview?.url) return null;
        return {
          id: item.id,
          provider: "tenor",
          provider_id: item.id,
          title: item.content_description || item.title || "GIF",
          url: full.url,
          preview_url: preview.url,
          width: full.dims?.[0] || null,
          height: full.dims?.[1] || null,
        };
      })
      .filter(Boolean);

    return jsonResponse({ results, next: data.next || null }, 200, origin);
  } catch (error) {
    console.error("search-gifs failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to search GIFs" },
      500,
      origin,
    );
  }
});
