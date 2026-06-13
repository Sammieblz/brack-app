import { App } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const TIMER_NOTIFICATION_ID = 1;
const TIMER_ACTION_TYPE = "TIMER_ACTION";

export interface TimerNotificationSnapshot {
  isRunning: boolean;
  isVisible: boolean;
  elapsedSeconds: number;
  bookId: string | null;
  bookTitle: string | null;
}

export interface AppStateChange {
  isActive: boolean;
}

const formatElapsed = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};

export const timerNativeService = {
  isNative() {
    return Capacitor.isNativePlatform();
  },

  onAppStateChange(handler: (state: AppStateChange) => void): () => void {
    if (!Capacitor.isNativePlatform()) return () => {};

    let active = true;
    let listener: PluginListenerHandle | null = null;

    void Promise.resolve(App.addListener("appStateChange", handler)).then((handle) => {
      if (!active) {
        handle.remove();
        return;
      }
      listener = handle;
    });

    return () => {
      active = false;
      listener?.remove();
    };
  },

  async requestNotificationPermissions(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    await LocalNotifications.requestPermissions();
  },

  async syncTimerNotification(snapshot: TimerNotificationSnapshot): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    if (!snapshot.isRunning || !snapshot.isVisible || !snapshot.bookTitle) {
      await this.clearTimerNotification();
      return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          title: `Reading: ${snapshot.bookTitle}`,
          body: `Timer running: ${formatElapsed(snapshot.elapsedSeconds)}`,
          id: TIMER_NOTIFICATION_ID,
          schedule: { at: new Date(Date.now() + 1000) },
          ongoing: true,
          sound: undefined,
          attachments: undefined,
          actionTypeId: TIMER_ACTION_TYPE,
          extra: {
            bookId: snapshot.bookId,
            action: "stop",
          },
        },
      ],
    });
  },

  async clearTimerNotification(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    await LocalNotifications.cancel({ notifications: [{ id: TIMER_NOTIFICATION_ID }] });
  },

  onTimerAction(handler: (action: "stop") => void): () => void {
    if (!Capacitor.isNativePlatform()) return () => {};

    let active = true;
    let listener: PluginListenerHandle | null = null;

    void Promise.resolve(
      LocalNotifications.addListener("localNotificationActionPerformed", (notification) => {
        if (notification.notification.extra?.action === "stop") {
          handler("stop");
        }
      })
    ).then((handle) => {
      if (!active) {
        handle.remove();
        return;
      }
      listener = handle;
    });

    return () => {
      active = false;
      listener?.remove();
    };
  },
};
