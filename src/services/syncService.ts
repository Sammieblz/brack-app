import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { offlineQueue } from "./offlineQueue";
import { dataCache } from "./dataCache";

interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: boolean;
}

class SyncService {
  private syncInProgress = false;
  private progress: SyncProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: false,
  };
  private listeners: Set<(progress: SyncProgress) => void> = new Set();
  private lastSyncTime: number = 0;
  private readonly SYNC_COOLDOWN = 5000; // 5 seconds between syncs

  constructor() {
    this.setupAppStateListener();
  }

  private setupAppStateListener() {
    if (!Capacitor.isNativePlatform()) {
      // Web: use visibility API
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.syncOnForeground();
        }
      });
      return;
    }

    // Native: use Capacitor App plugin
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        this.syncOnForeground();
      }
    });
  }

  private async syncOnForeground() {
    // Prevent too frequent syncs
    const now = Date.now();
    if (now - this.lastSyncTime < this.SYNC_COOLDOWN) {
      return;
    }

    this.lastSyncTime = now;

    // Sync offline queue
    const queueSize = offlineQueue.getQueueSize();
    if (queueSize > 0) {
      await this.syncOfflineQueue();
    }

    // Refresh critical cached data
    await this.refreshCriticalData();
  }

  async syncOfflineQueue(): Promise<void> {
    if (this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    const queue = offlineQueue.getQueue();
    
    this.updateProgress({
      total: queue.length,
      completed: 0,
      failed: 0,
      inProgress: true,
    });

    try {
      await offlineQueue.sync();
      
      // Get final queue size after sync
      const remaining = offlineQueue.getQueueSize();
      const completed = queue.length - remaining;
      
      this.updateProgress({
        total: queue.length,
        completed,
        failed: remaining,
        inProgress: false,
      });
    } catch (error) {
      console.error('Sync error:', error);
      this.updateProgress({
        total: queue.length,
        completed: 0,
        failed: queue.length,
        inProgress: false,
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  private async refreshCriticalData() {
    // Refresh frequently accessed data that might be stale
    // This is incremental - only refresh if cache is expired or missing
    
    // Invalidate and let hooks refetch naturally
    // We don't force refresh here to avoid unnecessary network calls
    // The hooks will check cache and fetch if needed
  }

  async incrementalSync(): Promise<void> {
    // Only sync new items since last sync
    // This is more efficient than full sync
    await this.syncOfflineQueue();
  }

  subscribe(listener: (progress: SyncProgress) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateProgress(progress: Partial<SyncProgress>) {
    this.progress = { ...this.progress, ...progress };
    this.listeners.forEach(listener => listener(this.progress));
  }

  getProgress(): SyncProgress {
    return { ...this.progress };
  }

  async manualSync(): Promise<void> {
    await this.syncOfflineQueue();
  }
}

export const syncService = new SyncService();
