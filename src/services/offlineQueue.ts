import {
  createBook,
  createJournalEntry,
  createMessageRecord,
  createPostRecord,
  createReviewRecord,
  deleteJournalEntry,
  softDeleteBook,
  updateBook,
  updateJournalEntry,
  updatePostRecord,
  updateReviewRecord,
} from "@/services/api";

export type QueueAction = 
  | { type: 'create_book'; data: Record<string, unknown> }
  | { type: 'update_book'; id: string; data: Record<string, unknown> }
  | { type: 'delete_book'; id: string }
  | { type: 'create_review'; data: Record<string, unknown> }
  | { type: 'update_review'; id: string; data: Record<string, unknown> }
  | { type: 'create_post'; data: Record<string, unknown> }
  | { type: 'update_post'; id: string; data: Record<string, unknown> }
  | { type: 'create_message'; data: Record<string, unknown> }
  | { type: 'create_journal_entry'; data: Record<string, unknown> }
  | { type: 'update_journal_entry'; id: string; data: Record<string, unknown> }
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
        } catch (error: unknown) {
          queuedAction.retries++;
          queuedAction.lastError = error instanceof Error ? error.message : String(error);

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
      case 'create_book': {
        await createBook(action.data);
        break;
      }

      case 'update_book': {
        await updateBook(action.id, action.data);
        break;
      }

      case 'delete_book': {
        await softDeleteBook(action.id);
        break;
      }

      case 'create_review': {
        await createReviewRecord(action.data);
        break;
      }

      case 'update_review': {
        await updateReviewRecord(action.id, action.data);
        break;
      }

      case 'create_post': {
        await createPostRecord(action.data);
        break;
      }

      case 'update_post': {
        await updatePostRecord(action.id, action.data);
        break;
      }

      case 'create_message': {
        await createMessageRecord(action.data);
        break;
      }

      case 'create_journal_entry': {
        await createJournalEntry(action.data);
        break;
      }

      case 'update_journal_entry': {
        await updateJournalEntry(action.id, action.data);
        break;
      }

      case 'delete_journal_entry': {
        await deleteJournalEntry(action.id);
        break;
      }

      default: {
        const _exhaustive: never = action;
        throw new Error(`Unknown action type: ${_exhaustive}`);
      }
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
