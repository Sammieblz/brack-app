import type { OutboxItem } from "./types";

export interface SyncFailurePresentation {
  kind: "schema_compatibility" | "unclassified";
  message: string;
  detail: string;
  showAttemptCount: boolean;
  technicalDetail?: string;
}

/**
 * The bookshelf migration can briefly reach a client before PostgREST knows
 * about the new books column. Keep this aligned with the engine's recovery
 * predicate and deliberately narrow: unrelated schema and validation failures
 * still need their normal review treatment.
 */
export const isSchemaCompatibilityFailure = (item: OutboxItem) => {
  if (item.entity !== "books" || !item.last_error) return false;
  const payload =
    typeof item.payload === "object" && item.payload !== null && !Array.isArray(item.payload)
      ? item.payload as Record<string, unknown>
      : {};
  if (!Object.prototype.hasOwnProperty.call(payload, "shelf_position")) return false;

  const message = item.last_error.toLowerCase();
  return (
    message.includes("shelf_position") &&
    message.includes("books") &&
    message.includes("schema cache") &&
    (message.includes("could not find") || message.includes("pgrst204"))
  );
};

export const getSyncFailurePresentation = (
  item: OutboxItem,
): SyncFailurePresentation => {
  const technicalDetail = item.last_error?.trim() || undefined;

  if (isSchemaCompatibilityFailure(item)) {
    return {
      kind: "schema_compatibility",
      message: "Waiting for a Brack service update",
      detail: "This edit is safe on this device. Retry after the service update is complete.",
      showAttemptCount: false,
      technicalDetail,
    };
  }

  return {
    kind: "unclassified",
    message: technicalDetail || "This change could not sync.",
    detail: `Attempted ${item.attempt_count} time${item.attempt_count === 1 ? "" : "s"}.`,
    showAttemptCount: true,
  };
};
