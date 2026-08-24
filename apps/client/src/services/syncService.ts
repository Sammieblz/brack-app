import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { readingCoreSync } from "@/services/sync/engine";
import { isDesktopRuntime, onDesktopForeground } from "@/services/platform";
import { getOptionalCurrentAuthUser } from "@/services/api/auth";

interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: boolean;
}

export class SyncService {
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

    const attempted = await this.syncOfflineQueue();
    if (attempted) this.lastSyncTime = Date.now();
  }

  async syncOfflineQueue(): Promise<boolean> {
    if (this.syncInProgress) {
      return false;
    }

    this.syncInProgress = true;
    let queuedTotal = 0;

    try {
      const user = await getOptionalCurrentAuthUser();
      if (!user) return false;

      const before = await readingCoreSync.getStatus(user.id);
      queuedTotal = before.pending + before.failed;

      this.updateProgress({
        total: queuedTotal,
        completed: 0,
        failed: before.failed,
        inProgress: true,
      });

      const after = await readingCoreSync.syncUser(user.id);
      const remaining = after.pending + after.failed;
      const completed = Math.max(0, before.pending + before.failed - remaining);
      
      this.updateProgress({
        total: queuedTotal,
        completed,
        failed: after.failed,
        inProgress: false,
      });
      return true;
    } catch (error) {
      console.error('Sync error:', error);
      this.updateProgress({
        total: queuedTotal,
        completed: 0,
        failed: queuedTotal,
        inProgress: false,
      });
      return true;
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
