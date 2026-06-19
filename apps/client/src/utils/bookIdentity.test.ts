import { describe, expect, it } from "vitest";
import type { Book } from "@/types";
import { findExistingLibraryBook } from "./bookIdentity";

const baseBook: Book = {
  id: "book-1",
  user_id: "user-1",
  title: "Their Eyes Were Watching God",
  author: "Zora Neale Hurston",
  isbn: "9780061120060",
  genre: "Fiction",
  pages: 219,
  chapters: null,
  cover_url: null,
  description: null,
  status: "to_read",
  tags: null,
  metadata: null,
  current_page: 0,
  date_started: null,
  date_finished: null,
  rating: null,
  notes: null,
  source_provider: null,
  source_id: null,
  shelf_position: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

describe("book duplicate identity", () => {
  it("prefers normalized ISBN matching", () => {
    expect(
      findExistingLibraryBook(
        { title: "Different metadata", author: null, isbn: "978-0-06-112006-0" },
        [baseBook]
      )?.id
    ).toBe(baseBook.id);
  });

  it("falls back to normalized title and author only when ISBN is absent", () => {
    const withoutIsbn = { ...baseBook, isbn: null };
    expect(
      findExistingLibraryBook(
        { title: "  THEIR EYES WERE WATCHING GOD ", author: "zora neale hurston", isbn: null },
        [withoutIsbn]
      )?.id
    ).toBe(baseBook.id);
  });
});
