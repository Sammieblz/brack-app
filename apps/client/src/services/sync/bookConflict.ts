import type { OutboxItem } from "./types";

const BOOK_IDENTITY_CONFLICT_MESSAGES = [
  "already exists",
  "book_exists",
  "duplicate key",
  "unique constraint",
  "json object requested, multiple (or no) rows returned",
  "remote book identity changed",
  "could not be reconciled",
];

/**
 * Failures that indicate two local/server identities represent the same book.
 * Deletes are deliberately excluded: replacing a failed delete with a server
 * copy would reverse the user's intent.
 */
export const isBookIdentityConflict = (item: OutboxItem) => {
  if (
    item.entity !== "books" ||
    !["create", "update", "restore"].includes(item.operation)
  ) {
    return false;
  }

  const error = (item.last_error || "").toLowerCase();
  return BOOK_IDENTITY_CONFLICT_MESSAGES.some((message) => error.includes(message));
};
