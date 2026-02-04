import { supabase } from "@/integrations/supabase/client";

export type QueueAction = 
  | { type: 'create_book'; data: any }
  | { type: 'update_book'; id: string; data: any }
  | { type: 'delete_book'; id: string }
  | { type: 'create_review'; data: any }
  | { type: 'update_review'; id: string; data: any }
  | { type: 'create_post'; data: any }
  | { type: 'update_post'; id: string; data: any }
  | { type: 'create_message'; data: any }
  | { type: 'create_journal_entry'; data: any }
  | { type: 'update_journal_entry'; id: string; data: any }
  | { type: 'delete_journal_entry'; id: string };

interface QueuedAction {
  id: string;
  action: QueueAction;
  timestamp: number;
  retries: number;
  lastError?: string;
}

const QUEUE_STORAGE_KEY = 'offline_queue';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

class OfflineQueueService {
  private queue: QueuedAction[] = [];
  private syncInProgress = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadQueue();
  }

  private loadQueue() {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      this.notifyListeners();
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  enqueue(action: QueueAction): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const queuedAction: QueuedAction = {
      id,
      action,
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(queuedAction);
    this.saveQueue();

    // Try to sync immediately if online
    if (navigator.onLine) {
      this.sync();
    }

    return id;
  }

  async sync(): Promise<void> {
    if (this.syncInProgress || this.queue.length === 0) {
      return;
    }

    if (!navigator.onLine) {
      return;
    }

    this.syncInProgress = true;

    try {
      const actionsToSync = [...this.queue];
      
      for (const queuedAction of actionsToSync) {
        try {
          await this.executeAction(queuedAction.action);
          
          // Remove successful action from queue
          this.queue = this.queue.filter(a => a.id !== queuedAction.id);
          this.saveQueue();
        } catch (error: any) {
          queuedAction.retries++;
          queuedAction.lastError = error.message;

          if (queuedAction.retries >= MAX_RETRIES) {
            // Remove action after max retries
            console.error('Action failed after max retries:', queuedAction);
            this.queue = this.queue.filter(a => a.id !== queuedAction.id);
            this.saveQueue();
          } else {
            // Update queue with retry info
            const index = this.queue.findIndex(a => a.id === queuedAction.id);
            if (index !== -1) {
              this.queue[index] = queuedAction;
              this.saveQueue();
            }
          }
        }

        // Small delay between actions to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.syncInProgress = false;
    }
  }

  private async executeAction(action: QueueAction): Promise<void> {
    switch (action.type) {
      case 'create_book':
        const { error: createBookError } = await supabase
          .from('books')
          .insert(action.data);
        if (createBookError) throw createBookError;
        break;

      case 'update_book':
        const { error: updateBookError } = await supabase
          .from('books')
          .update(action.data)
          .eq('id', action.id);
        if (updateBookError) throw updateBookError;
        break;

      case 'delete_book':
        const { error: deleteBookError } = await supabase
          .from('books')
          .delete()
          .eq('id', action.id);
        if (deleteBookError) throw deleteBookError;
        break;

      case 'create_review':
        const { error: createReviewError } = await supabase
          .from('book_reviews')
          .insert(action.data);
        if (createReviewError) throw createReviewError;
        break;

      case 'update_review':
        const { error: updateReviewError } = await supabase
          .from('book_reviews')
          .update(action.data)
          .eq('id', action.id);
        if (updateReviewError) throw updateReviewError;
        break;

      case 'create_post':
        const { error: createPostError } = await supabase
          .from('posts')
          .insert(action.data);
        if (createPostError) throw createPostError;
        break;

      case 'update_post':
        const { error: updatePostError } = await supabase
          .from('posts')
          .update(action.data)
          .eq('id', action.id);
        if (updatePostError) throw updatePostError;
        break;

      case 'create_message':
        const { error: createMessageError } = await supabase
          .from('messages')
          .insert(action.data);
        if (createMessageError) throw createMessageError;
        break;

      case 'create_journal_entry':
        const { error: createJournalError } = await supabase
          .from('journal_entries')
          .insert(action.data);
        if (createJournalError) throw createJournalError;
        break;

      case 'update_journal_entry':
        const { error: updateJournalError } = await supabase
          .from('journal_entries')
          .update(action.data)
          .eq('id', action.id);
        if (updateJournalError) throw updateJournalError;
        break;

      case 'delete_journal_entry':
        const { error: deleteJournalError } = await supabase
          .from('journal_entries')
          .delete()
          .eq('id', action.id);
        if (deleteJournalError) throw deleteJournalError;
        break;

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }
  }

  getQueue(): QueuedAction[] {
    return [...this.queue];
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }

  removeAction(id: string): void {
    this.queue = this.queue.filter(a => a.id !== id);
    this.saveQueue();
  }
}

export const offlineQueue = new OfflineQueueService();
