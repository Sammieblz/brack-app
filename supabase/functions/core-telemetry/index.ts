import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createServiceClient,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";

const ALLOWED_EVENTS = new Set([
  "book_search_succeeded",
  "book_search_failed",
  "book_search_cache_hit",
  "barcode_scan_succeeded",
  "barcode_scan_failed",
  "sync_succeeded",
  "sync_failed",
  "import_previewed",
  "import_completed",
  "import_failed",
  "duplicate_prevented",
]);

interface TelemetryRequest {
  event_name?: unknown;
  platform?: unknown;
  app_version?: unknown;
  metadata?: unknown;
}

const cleanMetadata = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const metadata = value as Record<string, unknown>;
  const serialized = JSON.stringify(metadata);
  if (serialized.length > 4096) {
    throw new Error("Telemetry metadata is too large");
  }
  return metadata;
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  try {
    const serviceClient = createServiceClient();
    const limited = await enforceRateLimit(req, serviceClient, {
      name: "core-telemetry",
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<TelemetryRequest>(req);
    const eventName =
      typeof body.event_name === "string" ? body.event_name.trim() : "";
    if (!ALLOWED_EVENTS.has(eventName)) {
      return jsonResponse({ error: "Unsupported telemetry event" }, 400, origin);
    }

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      const {
        data: { user },
      } = await serviceClient.auth.getUser(token);
      userId = user?.id ?? null;
    }

    const { error } = await serviceClient.from("core_telemetry_events").insert({
      user_id: userId,
      event_name: eventName,
      platform:
        typeof body.platform === "string" ? body.platform.slice(0, 32) : "web",
      app_version:
        typeof body.app_version === "string"
          ? body.app_version.slice(0, 64)
          : null,
      metadata: cleanMetadata(body.metadata),
    });

    if (error) throw error;
    return jsonResponse({ accepted: true }, 202, origin);
  } catch (error) {
    console.error("core-telemetry failed", error);
    return jsonResponse({ error: "Failed to record telemetry" }, 400, origin);
  }
});
