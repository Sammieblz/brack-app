import { invokeFunction } from "./client";
import { supabase } from "@/integrations/supabase/client";
import { dataCache } from "@/services/dataCache";
import {
  bookSearchCacheRepo,
  booksRepo,
  createLocalId,
  pendingBookImportsRepo,
} from "@/services/local";
import type { Book } from "@/types";
import { completeReading } from "./reading";
import { getCurrentAuthUser } from "./auth";
import {
  getConnectivityState,
  isConnectivityAvailable,
  isRetryableConnectivityError,
  markConnectivityFailure,
  markConnectivitySuccess,
} from "@/services/connectivity";
import { buildIsbnSearchQuery, canonicalizeIsbn } from "@/utils/isbn";
import { trackCoreEvent } from "@/services/telemetry";

export interface SearchBooksRequest {
  query: string;
  maxResults?: number;
}

export interface SearchBooksResponse<TBook = unknown> {
  books: TBook[];
  provider?: string;
  cached?: boolean;
  stale?: boolean;
}

const normalizeSearchKey = (query: string) =>
  query.trim().toLowerCase().replace(/\s+/g, " ");

const hashSearchKey = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `search-${(hash >>> 0).toString(16)}`;
};

export const searchBooks = async <TBook = unknown>(
  request: SearchBooksRequest
): Promise<SearchBooksResponse<TBook>> => {
  const queryKey = normalizeSearchKey(request.query);
  const user = await getCurrentAuthUser().catch(() => null);
  const localUserId = user?.id ?? "public";
  const cacheId = `${localUserId}:${hashSearchKey(queryKey)}`;
  const cached = await bookSearchCacheRepo.get(cacheId);
  const cacheFresh = cached && Date.parse(cached.expires_at) > Date.now();

  if (!isConnectivityAvailable() || getConnectivityState() === "offline") {
    if (cached) {
      trackCoreEvent("book_search_cache_hit", {
        stale: !cacheFresh,
        provider: cached.provider,
        isbn_lookup: Boolean(canonicalizeIsbn(request.query)),
      });
      return {
        books: cached.results as TBook[],
        provider: cached.provider ?? undefined,
        cached: true,
        stale: !cacheFresh,
      };
    }
    throw new Error("Book search is unavailable offline and no cached result was found");
  }

  try {
    const response = await invokeFunction<SearchBooksResponse<TBook>>("search-books", {
      body: request,
    });
    const timestamp = new Date().toISOString();
    await bookSearchCacheRepo.upsert(localUserId, {
      id: cacheId,
      user_id: localUserId,
      query_key: queryKey,
      query: request.query,
      isbn: canonicalizeIsbn(request.query),
      provider: response.provider ?? null,
      results: response.books as unknown[],
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: cached?.created_at ?? timestamp,
      updated_at: timestamp,
    });
    markConnectivitySuccess();
    trackCoreEvent("book_search_succeeded", {
      provider: response.provider,
      cached: Boolean(response.cached),
      stale: Boolean(response.stale),
      result_count: response.books.length,
      isbn_lookup: Boolean(canonicalizeIsbn(request.query)),
    });
    return response;
  } catch (error) {
    if (isRetryableConnectivityError(error)) {
      markConnectivityFailure();
      if (cached) {
        trackCoreEvent("book_search_cache_hit", {
          stale: true,
          provider: cached.provider,
          isbn_lookup: Boolean(canonicalizeIsbn(request.query)),
        });
        return {
          books: cached.results as TBook[],
          provider: cached.provider ?? undefined,
          cached: true,
          stale: true,
        };
      }
    }
    trackCoreEvent("book_search_failed", {
      retryable: isRetryableConnectivityError(error),
      isbn_lookup: Boolean(canonicalizeIsbn(request.query)),
    });
    throw error;
  }
};

export const lookupBookByIsbn = async <TBook = unknown>(isbnValue: string) => {
  const isbn = canonicalizeIsbn(isbnValue);
  if (!isbn) throw new Error("Invalid ISBN");
  const response = await searchBooks<TBook>({
    query: buildIsbnSearchQuery(isbn),
    maxResults: 10,
  });
  return { ...response, isbn, book: response.books[0] ?? null };
};

export const queuePendingBookImport = async (
  userId: string,
  input: { isbn?: string | null; query: string; source: "barcode" | "qr" | "cover" | "manual" }
) => {
  const timestamp = new Date().toISOString();
  const pendingImport = {
    id: createLocalId(),
    user_id: userId,
    isbn: input.isbn ? canonicalizeIsbn(input.isbn) : null,
    query: input.query,
    source: input.source,
    status: "pending" as const,
    resolved_book_id: null,
    last_error: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  await pendingBookImportsRepo.upsert(userId, pendingImport);
  return pendingImport;
};

export interface BooksPageResult {
  books: Book[];
  hasMore: boolean;
}

export const BOOKS_CHANGED_EVENT = "brack:books-changed";

export type BooksChangedDetail =
  | { type: "upsert"; userId?: string | null; book: Book }
  | { type: "remove"; userId?: string | null; bookId: string }
  | { type: "refresh"; userId?: string | null };

export interface AddLibraryBookResponse {
  success: boolean;
  action?: "created" | "restored";
  code?: "book_exists";
  message?: string;
  book_id?: string;
  book?: Book;
}

export interface ShelfPositionUpdate {
  id: string;
  shelf_position: number | null;
  updated_at?: string | null;
}

export interface ReorderLibraryShelfResponse {
  success: boolean;
  books: ShelfPositionUpdate[];
}

export class BookAlreadyExistsError extends Error {
  code = "book_exists" as const;
  bookId?: string;
  book?: Book;

  constructor(message = "Book already exists in your library", bookId?: string, book?: Book) {
    super(message);
    this.name = "BookAlreadyExistsError";
    this.bookId = bookId;
    this.book = book;
  }
}

export const isBookAlreadyExistsError = (error: unknown): error is BookAlreadyExistsError =>
  error instanceof BookAlreadyExistsError ||
  (typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "book_exists");

export const invalidateBooksCache = (userId?: string | null) => {
  dataCache.invalidate(userId ? `books_${userId}` : "books_");
};

export const emitBooksChanged = (detail: BooksChangedDetail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<BooksChangedDetail>(BOOKS_CHANGED_EVENT, { detail }));
};

export const fetchUserBooksPage = async (
  userId: string,
  offset: number,
  pageSize: number
): Promise<BooksPageResult> => {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) throw error;

  const books = (data || []) as Book[];
  return {
    books,
    hasMore: books.length === pageSize,
  };
};

export const fetchBookById = async (bookId: string): Promise<Book> => {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .single();

  if (error) throw error;
  return data as Book;
};

export const fetchActiveBookById = async (bookId: string): Promise<Book | null> => {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  return (data as Book | null) ?? null;
};

export const createBook = async (
  bookData: Record<string, unknown>
): Promise<Book> => {
  const response = await addBookToLibrary(bookData);
  if (!response.book) {
    throw new Error(response.message || "Failed to add book");
  }

  return response.book;
};

export const addBookToLibrary = async (
  bookData: Record<string, unknown>
): Promise<AddLibraryBookResponse> => {
  const { data, error } = await supabase.functions.invoke<AddLibraryBookResponse>("add-book", {
    body: bookData,
  });

  if (error) {
    const context = (error as { context?: Response }).context;
    if (context?.status === 409) {
      let payload: AddLibraryBookResponse | null = null;
      try {
        payload = (await context.clone().json()) as AddLibraryBookResponse;
      } catch {
        payload = null;
      }

      throw new BookAlreadyExistsError(
        payload?.message || "Book already exists in your library",
        payload?.book_id,
        payload?.book
      );
    }

    throw error;
  }

  if (data?.code === "book_exists") {
    trackCoreEvent("duplicate_prevented", { source: "add_book_endpoint" });
    throw new BookAlreadyExistsError(data.message, data.book_id, data.book);
  }

  if (data?.book) {
    await booksRepo.upsertRemote(data.book.user_id, data.book);
    invalidateBooksCache(data.book.user_id);
    emitBooksChanged({ type: "upsert", userId: data.book.user_id, book: data.book });
  }

  return data ?? { success: false, message: "Failed to add book" };
};

export const updateBook = async (
  bookId: string,
  updates: Record<string, unknown>
): Promise<void> => {
  const { data, error } = await supabase
    .from("books")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", bookId)
    .select()
    .single();

  if (error) throw error;

  const book = data as Book;
  await booksRepo.upsertRemote(book.user_id, book);
  invalidateBooksCache(book.user_id);
  emitBooksChanged({ type: "upsert", userId: book.user_id, book });
};

export const reorderLibraryShelf = async (
  orderedBooks: Book[]
): Promise<ReorderLibraryShelfResponse> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const timestamp = new Date().toISOString();
  const positionedBooks = orderedBooks.map((book, index) => ({
    ...book,
    shelf_position: index + 1,
    updated_at: timestamp,
  }));

  await Promise.all(
    positionedBooks.map(async (book) => {
      await booksRepo.upsertLocal(user.id, book, "update");
      emitBooksChanged({ type: "upsert", userId: user.id, book });
    })
  );

  invalidateBooksCache(user.id);
  if (isConnectivityAvailable()) {
    void import("@/services/sync/engine")
      .then(({ readingCoreSync }) => readingCoreSync.syncUser(user.id))
      .catch(console.error);
  }

  return {
    success: true,
    books: positionedBooks.map((book) => ({
      id: book.id,
      shelf_position: book.shelf_position,
      updated_at: book.updated_at,
    })),
  };
};

export const updateBookStatus = async (
  book: Book,
  newStatus: "reading" | "completed" | "to_read"
): Promise<Partial<Book>> => {
  if (newStatus === "completed") {
    const result = await completeReading({
      bookId: book.id,
      markComplete: true,
    });

    const updatedBook = result.book ?? {
      ...book,
      status: "completed",
      date_finished: book.date_finished || new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString(),
    };

    await booksRepo.upsertRemote(updatedBook.user_id, updatedBook);
    invalidateBooksCache(updatedBook.user_id);
    emitBooksChanged({ type: "upsert", userId: updatedBook.user_id, book: updatedBook });
    return updatedBook;
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === "reading" && !book.date_started) {
    updateData.date_started = new Date().toISOString();
  }

  const { error } = await supabase
    .from("books")
    .update(updateData)
    .eq("id", book.id);

  if (error) throw error;
  await booksRepo.upsertRemote(book.user_id, {
    ...book,
    ...updateData,
    updated_at: new Date().toISOString(),
  } as Book);
  invalidateBooksCache(book.user_id);
  emitBooksChanged({ type: "refresh", userId: book.user_id });
  return updateData as Partial<Book>;
};

export const softDeleteBook = async (bookId: string): Promise<void> => {
  const { data, error } = await supabase
    .from("books")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", bookId)
    .select("id, user_id")
    .single();

  if (error) throw error;

  const existing = await booksRepo.get(bookId);
  if (existing && data?.user_id) {
    await booksRepo.upsertRemote(data.user_id, {
      ...existing,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  invalidateBooksCache(data?.user_id);
  emitBooksChanged({ type: "remove", userId: data?.user_id, bookId });
};

export const fetchBookShareInfo = async (
  bookId: string
): Promise<{ title: string; author: string | null } | null> => {
  const { data, error } = await supabase
    .from("books")
    .select("title, author")
    .eq("id", bookId)
    .single();

  if (error) throw error;
  return data;
};

export const countUserBooks = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error) throw error;
  return count || 0;
};

export const updateBookQuickProgress = async (
  book: Book,
  pageNumber: number
): Promise<void> => {
  const updates: Record<string, unknown> = {
    current_page: pageNumber,
    updated_at: new Date().toISOString(),
  };

  if (book.pages && pageNumber >= book.pages && book.status !== "completed") {
    updates.status = "completed";
    updates.date_finished = new Date().toISOString().split("T")[0];
  }

  if (!book.date_started && pageNumber > 0) {
    updates.date_started = new Date().toISOString().split("T")[0];
  }

  if (
    book.status === "to_read" &&
    pageNumber > 0 &&
    (!book.pages || pageNumber < book.pages)
  ) {
    updates.status = "reading";
  }

  const updatedBook = { ...book, ...updates } as Book;
  await booksRepo.upsertLocal(book.user_id, updatedBook, "update");
  invalidateBooksCache(book.user_id);
  emitBooksChanged({ type: "upsert", userId: book.user_id, book: updatedBook });
  if (isConnectivityAvailable()) {
    void import("@/services/sync/engine").then(({ readingCoreSync }) =>
      readingCoreSync.syncUser(book.user_id).catch(console.error)
    );
  }
};
