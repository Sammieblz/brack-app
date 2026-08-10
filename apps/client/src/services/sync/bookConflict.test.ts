import { describe, expect, it } from "vitest";
import type { OutboxItem, SyncOperation } from "./types";
import { isBookIdentityConflict } from "./bookConflict";

const makeItem = (
  operation: SyncOperation,
  lastError: string,
  overrides: Partial<OutboxItem> = {},
): OutboxItem => ({
  id: "outbox-1",
  client_mutation_id: "mutation-1",
  client_entity_id: "book-1",
  user_id: "user-1",
  entity: "books",
  operation,
  payload: { title: "Supernova", isbn: "9781250078391" },
  status: "failed",
  attempt_count: 47,
  last_error: lastError,
  created_at: "2026-08-10T00:00:00.000Z",
  updated_at: "2026-08-10T00:00:00.000Z",
  next_attempt_at: null,
  ...overrides,
});

describe("book sync identity conflicts", () => {
  it.each(["create", "update", "restore"] as const)(
    "recognizes an already-existing book %s conflict",
    (operation) => {
      expect(isBookIdentityConflict(makeItem(operation, "Book already exists in your library"))).toBe(true);
    },
  );

  it("recognizes the stale-id PostgREST failure from older clients", () => {
    expect(
      isBookIdentityConflict(
        makeItem("update", "JSON object requested, multiple (or no) rows returned"),
      ),
    ).toBe(true);
  });

  it("never treats deletes or unrelated validation failures as server-copy conflicts", () => {
    expect(isBookIdentityConflict(makeItem("delete", "Book already exists in your library"))).toBe(false);
    expect(isBookIdentityConflict(makeItem("update", "Page count must be positive"))).toBe(false);
    expect(
      isBookIdentityConflict(
        makeItem("update", "Book already exists", { entity: "goals" }),
      ),
    ).toBe(false);
  });
});
