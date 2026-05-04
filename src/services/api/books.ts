import { invokeFunction } from "./client";
import { supabase } from "@/integrations/supabase/client";
import { dataCache } from "@/services/dataCache";
import type { Book } from "@/types";

export interface SearchBooksRequest {
  query: string;
  maxResults?: number;
}

export interface SearchBooksResponse<TBook = unknown> {
  books: TBook[];
}

export const searchBooks = async <TBook = unknown>(
  request: SearchBooksRequest
): Promise<SearchBooksResponse<TBook>> => {
  return invokeFunction<SearchBooksResponse<TBook>>("search-books", {
    body: request,
  });
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
    throw new BookAlreadyExistsError(data.message, data.book_id, data.book);
  }

  if (data?.book) {
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
  invalidateBooksCache(book.user_id);
  emitBooksChanged({ type: "upsert", userId: book.user_id, book });
};

export const updateBookStatus = async (
  book: Book,
  newStatus: "reading" | "completed" | "to_read"
): Promise<Partial<Book>> => {
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === "completed" && !book.date_finished) {
    updateData.date_finished = new Date().toISOString();
  }

  if (newStatus === "reading" && !book.date_started) {
    updateData.date_started = new Date().toISOString();
  }

  const { error } = await supabase
    .from("books")
    .update(updateData)
    .eq("id", book.id);

  if (error) throw error;
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

  const { error } = await supabase
    .from("books")
    .update(updates)
    .eq("id", book.id);

  if (error) throw error;
  invalidateBooksCache(book.user_id);
  emitBooksChanged({ type: "refresh", userId: book.user_id });
};
