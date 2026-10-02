import { describe, expect, it } from "vitest";
import type { Book } from "@/types";
import { buildBookEditorPatch, createBookEditorDraft, reconcileBookEditorDraft, validateEditedBook } from "./bookEditor";

const book = { id: "book", user_id: "reader", title: "Original", author: null, genre: null, isbn: null,
  pages: 200, chapters: null, current_page: 10, rating: null, status: "reading", tags: [],
  date_started: "1999-02-05", date_finished: null, series_name: null, series_position: null, series_total: null,
  cover_url: null, notes: null, metadata: { source: "preserved" }, description: null, source_provider: null,
  source_id: null, shelf_position: null, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", deleted_at: null } satisfies Book;

describe("book metadata draft", () => {
  it("creates a title-only patch so unrelated newer reading data is not overwritten", () => {
    const draft = { ...createBookEditorDraft(book), title: "New title" };
    expect(buildBookEditorPatch(book, draft)).toEqual({ patch: { title: "New title" }, errors: {} });
  });
  it.each(["3.5", "1e2", "-1", "two", "9007199254740992"])("retains and rejects invalid page input %s without truncation", pages => {
    const draft = { ...createBookEditorDraft(book), pages };
    expect(buildBookEditorPatch(book, draft).errors.pages).toBeTruthy();
    expect(draft.pages).toBe(pages);
  });
  it("keeps zero correction distinct from an empty optional number", () => {
    expect(buildBookEditorPatch(book, { ...createBookEditorDraft(book), current_page: "0", pages: "" }))
      .toEqual({ patch: { current_page: 0, pages: null }, errors: {} });
  });
  it("rejects a page correction beyond the known total", () => {
    expect(buildBookEditorPatch(book, { ...createBookEditorDraft(book), current_page: "201" }).errors.current_page).toBeTruthy();
  });
  it("supports half-book positions and explicit zero without changing activity or status", () => {
    expect(buildBookEditorPatch(book, { ...createBookEditorDraft(book), series_position: "0" }))
      .toEqual({ patch: { series_position: 0 }, errors: {} });
    expect(buildBookEditorPatch(book, { ...createBookEditorDraft(book), series_position: "1.5" }).errors).toEqual({});
    expect(buildBookEditorPatch(book, { ...createBookEditorDraft(book), series_position: "1.25" }).errors.series_position).toBeTruthy();
  });
  it("saves the visible pending tag once and preserves existing tags", () => {
    const baseline = { ...book, tags: ["reread"] };
    expect(buildBookEditorPatch(baseline, createBookEditorDraft(baseline), "  favorites  ").patch.tags).toEqual(["reread", "favorites"]);
    expect(buildBookEditorPatch(baseline, createBookEditorDraft(baseline), "reread").patch).toEqual({});
  });
  it("preserves explicit date clearing and checks the paired range", () => {
    expect(buildBookEditorPatch(book, { ...createBookEditorDraft(book), date_started: null }).patch).toEqual({ date_started: null });
    expect(buildBookEditorPatch(book, { ...createBookEditorDraft(book), date_finished: "1999-02-04" }).errors.date_finished).toBeTruthy();
  });
  it("detects cross-field conflicts after merging with a newer local record", () => {
    expect(validateEditedBook({ ...book, current_page: 150, pages: 100 }).current_page).toBeTruthy();
  });
  it("shows newer conflicting values while retaining the actual metadata edits", () => {
    const draft = { ...createBookEditorDraft(book), title: "My title", pages: "100" };
    const latest = { ...book, current_page: 150, notes: "Another saved note" };
    const reconciled = reconcileBookEditorDraft(book, latest, draft);
    expect(reconciled).toMatchObject({ title: "My title", pages: "100", current_page: "150", notes: "Another saved note" });
    expect(buildBookEditorPatch(latest, { ...reconciled, pages: "200" }).patch).toEqual({ title: "My title" });
  });
});
