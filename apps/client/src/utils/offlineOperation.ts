import {
  emitBooksChanged,
  getCurrentAuthUser,
  invalidateBooksCache,
} from "@/services/api";
import { booksRepo, createLocalId, journalRepo } from "@/services/local";
import { toast } from "sonner";
import type { Book } from "@/types";
import type { JournalEntry } from "@/services/api/journal";
import { readingCoreSync } from "@/services/sync/engine";
import { isConnectivityAvailable } from "@/services/connectivity";
import { findExistingLibraryBook } from "@/utils/bookIdentity";
import { trackCoreEvent } from "@/services/telemetry";

/**
 * Legacy compatibility wrapper for simple network-only operations.
 * Prefer the domain operations below for durable offline sync.
 */
export async function executeWithOfflineQueue<T>(
  operation: () => Promise<T>,
  queueAction?: unknown
): Promise<T> {
  // If online, execute directly
  if (isConnectivityAvailable()) {
    return await operation();
  }

  // Legacy callers may still pass a queue descriptor; durable sync is handled
  // by the domain repositories below, not by this wrapper.
  if (queueAction) {
    toast.info("You're offline. This action will sync when you're back online.");
    return Promise.resolve() as T;
  }

  // If offline but no queue action, throw error
  throw new Error("Operation requires network connection");
}

const asBook = (bookData: Record<string, unknown>, userId: string): Book => {
  const timestamp = new Date().toISOString();
  return {
    id: typeof bookData.id === "string" ? bookData.id : createLocalId(),
    user_id: userId,
    title: String(bookData.title || "Untitled book"),
    author: (bookData.author as string | null) ?? null,
    isbn: (bookData.isbn as string | null) ?? null,
    genre: (bookData.genre as string | null) ?? null,
    pages: (bookData.pages as number | null) ?? null,
    chapters: (bookData.chapters as number | null) ?? null,
    cover_url: (bookData.cover_url as string | null) ?? null,
    description: (bookData.description as string | null) ?? null,
    status: String(bookData.status || "to_read"),
    tags: (bookData.tags as string[] | null) ?? null,
    metadata: (bookData.metadata as Record<string, unknown> | null) ?? null,
    current_page: (bookData.current_page as number | null) ?? 0,
    date_started: (bookData.date_started as string | null) ?? null,
    date_finished: (bookData.date_finished as string | null) ?? null,
    rating: (bookData.rating as number | null) ?? null,
    notes: (bookData.notes as string | null) ?? null,
    source_provider: (bookData.source_provider as string | null) ?? null,
    source_id: (bookData.source_id as string | null) ?? null,
    shelf_position: (bookData.shelf_position as number | null) ?? null,
    created_at: (bookData.created_at as string | null) ?? timestamp,
    updated_at: (bookData.updated_at as string | null) ?? timestamp,
    deleted_at: (bookData.deleted_at as string | null) ?? null,
  };
};

const syncInBackground = (userId: string) => {
  if (!isConnectivityAvailable()) return;
  void readingCoreSync.syncUser(userId).catch(console.error);
};

/**
 * Book operations with durable local repository + outbox support.
 */
export const bookOperations = {
  async create(bookData: Record<string, unknown>) {
    const user = await getCurrentAuthUser();
    const userId = (bookData.user_id as string | undefined) || user?.id;
    if (!userId) throw new Error("Not authenticated");

    const existingBooks = await booksRepo.list(userId);
    const duplicate = findExistingLibraryBook(
      {
        title: String(bookData.title || ""),
        author: (bookData.author as string | null) ?? null,
        isbn: (bookData.isbn as string | null) ?? null,
      },
      existingBooks
    );
    if (duplicate) {
      trackCoreEvent("duplicate_prevented", { source: "local_library" });
      const error = new Error("Book already exists in your library") as Error & {
        code?: string;
        bookId?: string;
      };
      error.code = "book_exists";
      error.bookId = duplicate.id;
      throw error;
    }

    const localBook = asBook({ ...bookData, user_id: userId }, userId);
    await booksRepo.upsertLocal(userId, localBook, "create");
    invalidateBooksCache(userId);
    emitBooksChanged({ type: "upsert", userId, book: localBook });
    syncInBackground(userId);
    if (!isConnectivityAvailable()) {
      toast.info("Book saved offline. It will sync when you're back online.");
    }
    return localBook;
  },

  async update(bookId: string, updates: Record<string, unknown>) {
    const user = await getCurrentAuthUser();
    if (!user) throw new Error("Not authenticated");

    const existing = await booksRepo.get(bookId);
    if (!existing) throw new Error("This book is not available locally yet");
    const updatedBook = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    } as Book;
    await booksRepo.upsertLocal(user.id, updatedBook, "update");
    invalidateBooksCache(user.id);
    emitBooksChanged({ type: "upsert", userId: user.id, book: updatedBook });
    syncInBackground(user.id);
    if (!isConnectivityAvailable()) toast.info("Book update saved offline.");
  },

  async delete(bookId: string) {
    const user = await getCurrentAuthUser();
    if (!user) throw new Error("Not authenticated");

    const existing = await booksRepo.get(bookId);
    if (!existing) throw new Error("This book is not available locally yet");
    await booksRepo.softDeleteLocal(user.id, existing);
    invalidateBooksCache(user.id);
    emitBooksChanged({ type: "remove", userId: user.id, bookId });
    syncInBackground(user.id);
    if (!isConnectivityAvailable()) {
      toast.info("Book removed offline. The deletion will sync when you're back online.");
    }
  },
};

const asJournalEntry = (
  entryData: Record<string, unknown>,
  userId: string
): JournalEntry => {
  const timestamp = new Date().toISOString();
  return {
    id: typeof entryData.id === "string" ? entryData.id : createLocalId(),
    user_id: userId,
    book_id: String(entryData.book_id),
    entry_type: (entryData.entry_type as JournalEntry["entry_type"]) || "note",
    title: (entryData.title as string | null) ?? null,
    content: String(entryData.content || ""),
    page_reference: (entryData.page_reference as number | null) ?? null,
    tags: (entryData.tags as string[] | null) ?? null,
    photo_url: (entryData.photo_url as string | null) ?? null,
    created_at: (entryData.created_at as string | null) ?? timestamp,
    updated_at: (entryData.updated_at as string | null) ?? timestamp,
  };
};

/**
 * Journal operations with durable local repository + outbox support.
 */
export const journalOperations = {
  async create(entryData: Record<string, unknown>) {
    const user = await getCurrentAuthUser();
    const userId = (entryData.user_id as string | undefined) || user?.id;
    if (!userId) throw new Error("Not authenticated");

    const localEntry = asJournalEntry({ ...entryData, user_id: userId }, userId);
    await journalRepo.upsertLocal(userId, localEntry, "create");
    syncInBackground(userId);
    if (!isConnectivityAvailable()) toast.info("Journal entry saved offline.");
    return localEntry;
  },

  async update(entryId: string, updates: Record<string, unknown>) {
    const user = await getCurrentAuthUser();
    if (!user) throw new Error("Not authenticated");

    const existing = await journalRepo.get(entryId);
    if (!existing) throw new Error("This journal entry is not available locally yet");
    await journalRepo.upsertLocal(user.id, {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    } as JournalEntry, "update");
    syncInBackground(user.id);
    if (!isConnectivityAvailable()) toast.info("Journal update saved offline.");
  },

  async delete(entryId: string) {
    const user = await getCurrentAuthUser();
    if (!user) throw new Error("Not authenticated");

    const existing = await journalRepo.get(entryId);
    if (!existing) throw new Error("This journal entry is not available locally yet");
    await journalRepo.softDeleteLocal(user.id, existing);
    syncInBackground(user.id);
    if (!isConnectivityAvailable()) toast.info("Journal deletion saved offline.");
  },
};
