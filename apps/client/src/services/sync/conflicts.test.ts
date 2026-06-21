import { describe, expect, it } from "vitest";
import type { Book } from "@/types";
import type { LocalRecord } from "./types";
import { resolveBookSyncConflict } from "./conflicts";

const book = (overrides: Partial<Book> = {}): Book => ({
  id: "book-1",
  user_id: "user-1",
  title: "A Book",
  author: "An Author",
  isbn: null,
  genre: null,
  pages: 300,
  chapters: null,
  cover_url: null,
  description: null,
  status: "reading",
  tags: null,
  metadata: null,
  current_page: 40,
  date_started: null,
  date_finished: null,
  rating: null,
  notes: null,
  source_provider: null,
  source_id: null,
  shelf_position: null,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-10T00:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

const localRecord = (data: Book): LocalRecord<Book> => ({
  id: data.id,
  user_id: data.user_id,
  data,
  status: data.deleted_at ? "deleted" : "pending",
  updated_at: data.updated_at,
  deleted_at: data.deleted_at,
  last_synced_at: null,
});

describe("resolveBookSyncConflict", () => {
  it("keeps a newer local tombstone over a stale remote update", () => {
    const local = book({
      deleted_at: "2026-06-12T00:00:00.000Z",
      updated_at: "2026-06-12T00:00:00.000Z",
    });
    const remote = book({ updated_at: "2026-06-11T00:00:00.000Z" });

    expect(resolveBookSyncConflict(localRecord(local), remote).deleted_at).toBe(
      local.deleted_at,
    );
  });

  it("keeps a newer completed state over an older reading state", () => {
    const local = book({
      status: "completed",
      current_page: 300,
      date_finished: "2026-06-12",
      updated_at: "2026-06-12T00:00:00.000Z",
    });
    const remote = book({
      status: "reading",
      updated_at: "2026-06-11T00:00:00.000Z",
    });

    expect(resolveBookSyncConflict(localRecord(local), remote).status).toBe(
      "completed",
    );
  });

  it("accepts a newer remote correction", () => {
    const local = book({ current_page: 100 });
    const remote = book({
      current_page: 80,
      updated_at: "2026-06-13T00:00:00.000Z",
    });

    expect(resolveBookSyncConflict(localRecord(local), remote).current_page).toBe(
      80,
    );
  });
});
