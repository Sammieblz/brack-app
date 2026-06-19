import { describe, expect, it } from "vitest";
import type { GoogleBookResult } from "@/types/googleBooks";
import {
  findExactScannedBookMatch,
  toScannedLibraryBookPayload,
  type ScannedBookMatch,
} from "./scannerBookFlow";

const makeBook = (overrides: Partial<GoogleBookResult>): GoogleBookResult => ({
  googleBooksId: "provider-book",
  source_provider: "google_books",
  source_id: "provider-book",
  title: "Test Book",
  author: "Test Author",
  isbn: "9780306406157",
  genre: "Computers",
  pages: 320,
  chapters: null,
  cover_url: "https://example.com/cover.jpg",
  description: "A test book",
  publisher: null,
  published_date: null,
  average_rating: null,
  ratings_count: null,
  ...overrides,
});

describe("scanner book flow", () => {
  it("matches a scanned ISBN-13 against an ISBN-10 provider result", () => {
    const match = findExactScannedBookMatch("9780306406157", [
      makeBook({ googleBooksId: "wrong", isbn: "9780131103627" }),
      makeBook({ googleBooksId: "exact", isbn: "0-306-40615-2" }),
    ]);

    expect(match?.googleBooksId).toBe("exact");
  });

  it("rejects provider results that do not exactly match the scanned ISBN", () => {
    const match = findExactScannedBookMatch("9780306406157", [
      makeBook({ googleBooksId: "wrong", isbn: "9780131103627" }),
      makeBook({ googleBooksId: "missing", isbn: null }),
    ]);

    expect(match).toBeNull();
  });

  it("builds a to-read add-book payload from the scanned match", () => {
    const match: ScannedBookMatch = {
      isbn: "9780306406157",
      provider: "google_books",
      cached: false,
      book: makeBook({
        title: "The Scanned Book",
        genre: "Computers",
        pages: 220,
      }),
    };

    expect(toScannedLibraryBookPayload(match)).toMatchObject({
      title: "The Scanned Book",
      isbn: "9780306406157",
      status: "to_read",
      genre: "Computers & Technology",
      pages: 220,
      source_provider: "google_books",
      source_id: "provider-book",
    });
  });
});
