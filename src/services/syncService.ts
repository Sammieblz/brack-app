import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { readingCoreSync } from "@/services/sync/engine";
import { isDesktopRuntime, onDesktopForeground } from "@/services/platform";

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
    if (isDesktopRuntime()) {
      onDesktopForeground(() => {
        this.syncOnForeground();
      });
    }

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

    await this.syncOfflineQueue();
  }

  async syncOfflineQueue(): Promise<void> {
    if (this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    const before = await readingCoreSync.getStatus();
    
    this.updateProgress({
      total: before.pending + before.failed,
      completed: 0,
      failed: before.failed,
      inProgress: true,
    });

    try {
      const after = await readingCoreSync.syncCurrentUser();
      const remaining = after.pending + after.failed;
      const completed = Math.max(0, before.pending + before.failed - remaining);
      
      this.updateProgress({
        total: before.pending + before.failed,
        completed,
        failed: after.failed,
        inProgress: false,
      });
    } catch (error) {
      console.error('Sync error:', error);
      this.updateProgress({
        total: before.pending + before.failed,
        completed: 0,
        failed: before.pending + before.failed,
        inProgress: false,
      });
    } finally {
      this.syncInProgress = false;
    }
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
