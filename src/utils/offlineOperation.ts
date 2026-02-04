import { offlineQueue } from "@/services/offlineQueue";
import { supabase } from "@/integrations/supabase/client";
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
    try {
      return await operation();
    } catch (error: any) {
      // If operation fails and we're still online, it's a real error
      throw error;
    }
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
  async create(bookData: any) {
    return executeWithOfflineQueue(
      async () => {
        const { data, error } = await supabase
          .from('books')
          .insert(bookData)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      { type: 'create_book', data: bookData }
    );
  },

  async update(bookId: string, updates: any) {
    return executeWithOfflineQueue(
      async () => {
        const { error } = await supabase
          .from('books')
          .update(updates)
          .eq('id', bookId);
        if (error) throw error;
      },
      { type: 'update_book', id: bookId, data: updates }
    );
  },

  async delete(bookId: string) {
    return executeWithOfflineQueue(
      async () => {
        const { error } = await supabase
          .from('books')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', bookId);
        if (error) throw error;
      },
      { type: 'delete_book', id: bookId }
    );
  },
};

/**
 * Helper to create journal entry operations with offline queue support
 */
export const journalOperations = {
  async create(entryData: any) {
    return executeWithOfflineQueue(
      async () => {
        const { data, error } = await supabase
          .from('journal_entries')
          .insert(entryData)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      { type: 'create_journal_entry', data: entryData }
    );
  },

  async update(entryId: string, updates: any) {
    return executeWithOfflineQueue(
      async () => {
        const { error } = await supabase
          .from('journal_entries')
          .update(updates)
          .eq('id', entryId);
        if (error) throw error;
      },
      { type: 'update_journal_entry', id: entryId, data: updates }
    );
  },

  async delete(entryId: string) {
    return executeWithOfflineQueue(
      async () => {
        const { error } = await supabase
          .from('journal_entries')
          .delete()
          .eq('id', entryId);
        if (error) throw error;
      },
      { type: 'delete_journal_entry', id: entryId }
    );
  },
};
