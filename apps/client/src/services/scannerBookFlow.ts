import {
  addBookToLibrary,
  BookAlreadyExistsError,
  lookupBookByIsbn,
} from "@/services/api/books";
import { getCurrentAuthUser } from "@/services/api/auth";
import {
  getConnectivityState,
  isConnectivityAvailable,
  isRetryableConnectivityError,
  probeConnectivity,
} from "@/services/connectivity";
import { booksRepo } from "@/services/local";
import { trackCoreEvent } from "@/services/telemetry";
import type { Book } from "@/types";
import type { GoogleBookResult } from "@/types/googleBooks";
import { findExistingLibraryBook } from "@/utils/bookIdentity";
import { normalizeGenre } from "@/utils/genres";
import { canonicalizeIsbn } from "@/utils/isbn";

export type BarcodeAddState =
  | "idle"
  | "scanning"
  | "finding"
  | "preview"
  | "adding"
  | "success"
  | "duplicate"
  | "no_match"
  | "offline"
  | "error";

export interface ScannedBookMatch {
  isbn: string;
  book: GoogleBookResult;
  provider?: string;
  cached?: boolean;
  stale?: boolean;
}

export interface ScannedBookAddResult {
  status: "created" | "restored" | "duplicate";
  book?: Book;
  bookId?: string;
}

export class ScannedBookNoMatchError extends Error {
  isbn: string;

  constructor(isbn: string, message = "No exact book match was found for this ISBN") {
    super(message);
    this.name = "ScannedBookNoMatchError";
    this.isbn = isbn;
  }
}

export class ScannerConnectivityError extends Error {
  constructor(message = "Connect to the internet to look up this ISBN") {
    super(message);
    this.name = "ScannerConnectivityError";
  }
}

export const findExactScannedBookMatch = (
  scannedIsbnValue: string,
  books: GoogleBookResult[]
) => {
  const scannedIsbn = canonicalizeIsbn(scannedIsbnValue);
  if (!scannedIsbn) return null;

  return (
    books.find((book) => {
      if (!book.isbn) return false;
      return canonicalizeIsbn(book.isbn) === scannedIsbn;
    }) ?? null
  );
};

export const toScannedLibraryBookPayload = (
  match: ScannedBookMatch
): Record<string, unknown> => ({
  title: match.book.title,
  author: match.book.author,
  isbn: match.isbn,
  genre: normalizeGenre(match.book.genre),
  pages: match.book.pages,
  chapters: match.book.chapters,
  status: "to_read",
  cover_url: match.book.cover_url,
  description: match.book.description,
  tags: null,
  metadata: {
    scanned_isbn: match.isbn,
    provider: match.provider ?? match.book.source_provider ?? null,
    cached_result: Boolean(match.cached),
  },
  current_page: 0,
  date_started: null,
  date_finished: null,
  rating: null,
  notes: null,
  source_provider: match.book.source_provider ?? match.provider ?? null,
  source_id: match.book.source_id ?? match.book.googleBooksId ?? null,
});

const ensureLookupConnectivity = async () => {
  const state = getConnectivityState();
  if (state === "offline" || state === "authentication_required") {
    await probeConnectivity(true);
  }

  if (!isConnectivityAvailable()) {
    throw new ScannerConnectivityError();
  }
};

export const resolveScannedBook = async (isbnValue: string): Promise<ScannedBookMatch> => {
  const isbn = canonicalizeIsbn(isbnValue);
  if (!isbn) {
    trackCoreEvent("barcode_scan_failed", { reason: "invalid_isbn" });
    throw new ScannedBookNoMatchError(isbnValue, "This barcode does not contain a valid ISBN");
  }

  await ensureLookupConnectivity();

  try {
    const response = await lookupBookByIsbn<GoogleBookResult>(isbn);
    if (response.cached && !isConnectivityAvailable()) {
      throw new ScannerConnectivityError();
    }

    const exactMatch = findExactScannedBookMatch(isbn, response.books);
    if (!exactMatch) {
      trackCoreEvent("book_search_failed", {
        isbn_lookup: true,
        reason: "no_exact_isbn_match",
        result_count: response.books.length,
      });
      throw new ScannedBookNoMatchError(isbn);
    }

    return {
      isbn,
      book: exactMatch,
      provider: response.provider ?? exactMatch.source_provider ?? undefined,
      cached: Boolean(response.cached),
      stale: Boolean(response.stale),
    };
  } catch (error) {
    if (error instanceof ScannedBookNoMatchError) throw error;
    if (isRetryableConnectivityError(error)) {
      throw new ScannerConnectivityError();
    }
    throw error;
  }
};

export const addScannedBookToLibrary = async (
  match: ScannedBookMatch
): Promise<ScannedBookAddResult> => {
  await ensureLookupConnectivity();

  try {
    const user = await getCurrentAuthUser();
    const localBooks = await booksRepo.list(user.id);
    const existingBook = findExistingLibraryBook(
      { title: match.book.title, author: match.book.author, isbn: match.isbn },
      localBooks
    );

    if (existingBook) {
      trackCoreEvent("duplicate_prevented", { source: "barcode_local_library" });
      return { status: "duplicate", book: existingBook, bookId: existingBook.id };
    }

    const response = await addBookToLibrary(toScannedLibraryBookPayload(match));
    if (!response.book && response.code === "book_exists") {
      return { status: "duplicate", bookId: response.book_id };
    }

    if (!response.book) {
      throw new Error(response.message || "Failed to add scanned book");
    }

    return {
      status: response.action === "restored" ? "restored" : "created",
      book: response.book,
      bookId: response.book.id,
    };
  } catch (error) {
    if (error instanceof BookAlreadyExistsError) {
      trackCoreEvent("duplicate_prevented", { source: "barcode_add_endpoint" });
      return { status: "duplicate", book: error.book, bookId: error.book?.id ?? error.bookId };
    }

    if (isRetryableConnectivityError(error)) {
      throw new ScannerConnectivityError();
    }

    throw error;
  }
};
