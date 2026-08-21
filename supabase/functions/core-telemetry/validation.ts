export const ALLOWED_TELEMETRY_EVENTS: ReadonlySet<string> = new Set([
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
  "journey_opened",
  "journey_tab_viewed",
  "daily_focus_started",
]);

export const AUTHENTICATED_TELEMETRY_EVENTS: ReadonlySet<string> = new Set([
  "journey_opened",
  "journey_tab_viewed",
  "daily_focus_started",
]);

const JOURNEY_SOURCES = new Set([
  "dashboard",
  "dashboard_hud",
  "dashboard_daily_focus",
  "journey",
  "journey_overview",
  "journey_quests",
  "navigation",
  "notification",
  "deep_link",
  "unknown",
]);

const JOURNEY_TABS = new Set([
  "overview",
  "quests",
  "shop",
  "badges",
  "rankings",
]);

const JOURNEY_FRESHNESS_STATES = new Set([
  "live",
  "cached",
  "expired",
  "unavailable",
  "provisional",
]);

const QUEST_METRICS = new Set([
  "reading_minutes",
  "pages_read",
  "reading_days",
  "sessions",
  "books_completed",
  "velocity",
  "series_books_completed",
]);

const JOURNEY_METADATA_KEYS: Record<string, ReadonlySet<string>> = {
  journey_opened: new Set(["source", "freshness"]),
  journey_tab_viewed: new Set(["source", "destination_tab", "freshness"]),
  daily_focus_started: new Set(["source", "quest_metric", "freshness"]),
};

type JsonRecord = Record<string, unknown>;

export class TelemetryValidationError extends Error {}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requiredEnum = (
  metadata: JsonRecord,
  key: string,
  allowed: ReadonlySet<string>,
): void => {
  const value = metadata[key];
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new TelemetryValidationError(`Invalid telemetry metadata: ${key}`);
  }
};

const optionalEnum = (
  metadata: JsonRecord,
  key: string,
  allowed: ReadonlySet<string>,
): void => {
  if (metadata[key] === undefined) return;
  requiredEnum(metadata, key, allowed);
};

const cleanJsonMetadata = (value: unknown): JsonRecord => {
  if (!value || !isRecord(value)) return {};

  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new TelemetryValidationError("Telemetry metadata must be valid JSON");
  }
  if (typeof serialized !== "string") {
    throw new TelemetryValidationError("Telemetry metadata must be valid JSON");
  }
  if (serialized.length > 4096) {
    throw new TelemetryValidationError("Telemetry metadata is too large");
  }

  return JSON.parse(serialized) as JsonRecord;
};

export const isAllowedTelemetryEvent = (eventName: string): boolean =>
  ALLOWED_TELEMETRY_EVENTS.has(eventName);

export const requiresAuthenticatedTelemetry = (eventName: string): boolean =>
  AUTHENTICATED_TELEMETRY_EVENTS.has(eventName);

export const cleanTelemetryMetadata = (
  eventName: string,
  value: unknown,
): JsonRecord => {
  const metadata = cleanJsonMetadata(value);
  if (!requiresAuthenticatedTelemetry(eventName)) return metadata;

  const allowedKeys = JOURNEY_METADATA_KEYS[eventName];
  for (const key of Object.keys(metadata)) {
    if (!allowedKeys.has(key)) {
      throw new TelemetryValidationError(
        `Unsupported telemetry metadata: ${key}`,
      );
    }
  }

  requiredEnum(metadata, "source", JOURNEY_SOURCES);
  optionalEnum(metadata, "freshness", JOURNEY_FRESHNESS_STATES);

  if (eventName === "journey_tab_viewed") {
    requiredEnum(metadata, "destination_tab", JOURNEY_TABS);
  }
  if (eventName === "daily_focus_started") {
    requiredEnum(metadata, "quest_metric", QUEST_METRICS);
  }

  return metadata;
};
