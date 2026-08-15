import { describe, expect, it } from "vitest";
import type { OutboxItem } from "./types";
import {
  getSyncFailurePresentation,
  isSchemaCompatibilityFailure,
} from "./failurePresentation";

const makeItem = (lastError: string): OutboxItem => ({
  id: "outbox-1",
  client_mutation_id: "mutation-1",
  client_entity_id: "book-1",
  user_id: "user-1",
  entity: "books",
  operation: "update",
  payload: { shelf_position: 4 },
  status: "failed",
  attempt_count: 47,
  last_error: lastError,
  created_at: "2026-08-10T00:00:00.000Z",
  updated_at: "2026-08-10T00:00:00.000Z",
  next_attempt_at: null,
});

describe("sync failure presentation", () => {
  it("classifies a PostgREST missing-column schema-cache response as a service mismatch", () => {
    const item = makeItem(
      "Could not find the 'shelf_position' column of 'books' in the schema cache",
    );

    expect(isSchemaCompatibilityFailure(item)).toBe(true);
    expect(getSyncFailurePresentation(item)).toEqual({
      kind: "schema_compatibility",
      message: "Waiting for a Brack service update",
      detail: "This edit is safe on this device. Retry after the service update is complete.",
      showAttemptCount: false,
      technicalDetail: item.last_error,
    });
  });

  it("keeps actionable validation failures visible with their attempt count", () => {
    const item = makeItem("Page count must be positive");

    expect(isSchemaCompatibilityFailure(item)).toBe(false);
    expect(getSyncFailurePresentation(item)).toEqual({
      kind: "unclassified",
      message: "Page count must be positive",
      detail: "Attempted 47 times.",
      showAttemptCount: true,
    });
  });

  it("does not hide unrelated schema failures behind the bookshelf rollout message", () => {
    const item = {
      ...makeItem("Could not find the 'timezone' column of 'profiles' in the schema cache"),
      entity: "profile_preferences" as const,
      payload: { timezone: "America/New_York" },
    };

    expect(isSchemaCompatibilityFailure(item)).toBe(false);
    expect(getSyncFailurePresentation(item).message).toContain("timezone");
  });
});
