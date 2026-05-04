import { offlineQueue } from "@/services/offlineQueue";
import {
  createBook,
  createJournalEntry,
  deleteJournalEntry,
  softDeleteBook,
  updateBook,
  updateJournalEntry,
} from "@/services/api";
import { toast } from "sonner";

/**
 * Wraps a Supabase operation to automatically queue it when offline
 * @param operation - The async function that performs the Supabase operation
 * @param queueAction - The action to queue if offline
 * @returns Promise that resolves when operation completes or is queued
 */
export async function executeWithOfflineQueue<T>(
  operation: () => Promise<T>,
  queueAction?: Parameters<typeof offlineQueue.enqueue>[0]
): Promise<T> {
  // If online, execute directly
  if (navigator.onLine) {
    return await operation();
  }

  // If offline and queue action provided, queue it
  if (queueAction) {
    const queueId = offlineQueue.enqueue(queueAction);
    toast.info("You're offline. This action will be synced when you're back online.");
    // Return a promise that resolves immediately (action is queued)
    return Promise.resolve() as T;
  }

  // If offline but no queue action, throw error
  throw new Error("Operation requires network connection");
}

/**
 * Helper to create book operations with offline queue support
 */
export const bookOperations = {
  async create(bookData: Record<string, unknown>) {
    return executeWithOfflineQueue(
      () => createBook(bookData),
      { type: 'create_book', data: bookData }
    );
  },

  async update(bookId: string, updates: Record<string, unknown>) {
    return executeWithOfflineQueue(
      () => updateBook(bookId, updates),
      { type: 'update_book', id: bookId, data: updates }
    );
  },

  async delete(bookId: string) {
    return executeWithOfflineQueue(
      () => softDeleteBook(bookId),
      { type: 'delete_book', id: bookId }
    );
  },
};

/**
 * Helper to create journal entry operations with offline queue support
 */
export const journalOperations = {
  async create(entryData: Record<string, unknown>) {
    return executeWithOfflineQueue(
      () => createJournalEntry(entryData),
      { type: 'create_journal_entry', data: entryData }
    );
  },

  async update(entryId: string, updates: Record<string, unknown>) {
    return executeWithOfflineQueue(
      () => updateJournalEntry(entryId, updates),
      { type: 'update_journal_entry', id: entryId, data: updates }
    );
  },

  async delete(entryId: string) {
    return executeWithOfflineQueue(
      () => deleteJournalEntry(entryId),
      { type: 'delete_journal_entry', id: entryId }
    );
  },
};
