import { App } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const TIMER_NOTIFICATION_ID = 1;
const TIMER_ACTION_TYPE = "TIMER_ACTION";
export interface TimerNotificationSnapshot {
  isRunning: boolean; isVisible: boolean; elapsedSeconds: number;
  bookId: string | null; bookTitle: string | null;
  userId?: string | null; clientSessionId?: string | null;
}
export interface AppStateChange { isActive: boolean; }
export interface TimerNotificationIdentity { userId: string; clientSessionId: string; }
const formatElapsed = (seconds: number) => {
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds % 60}s`;
};
let notificationRevision = 0;
let notificationQueue: Promise<void> = Promise.resolve();
let actionsReady: Promise<void> | null = null;
const removeListener = (listener: PluginListenerHandle) => { void listener.remove().catch(error => console.error("Unable to remove timer listener:", error)); };
const clearNativeNotification = async () => {
  await LocalNotifications.cancel({ notifications: [{ id: TIMER_NOTIFICATION_ID }] });
  const delivered = await LocalNotifications.getDeliveredNotifications();
  const timers = delivered.notifications.filter(notification => notification.id === TIMER_NOTIFICATION_ID);
  if (timers.length) await LocalNotifications.removeDeliveredNotifications({ notifications: timers });
};
const enqueue = (operation: (revision: number) => Promise<void>) => {
  const revision = ++notificationRevision;
  const pending = notificationQueue.catch(() => undefined).then(() => operation(revision));
  notificationQueue = pending.catch(() => undefined);
  return pending;
};
const registerActions = () => {
  if (!actionsReady) actionsReady = LocalNotifications.registerActionTypes({ types: [{ id: TIMER_ACTION_TYPE,
    actions: [{ id: "stop", title: "Finish reading", foreground: true }] }] }).catch(error => { actionsReady = null; throw error; });
  return actionsReady;
};
export const timerNativeService = {
  isNative() { return Capacitor.isNativePlatform(); },
  onAppStateChange(handler: (state: AppStateChange) => void): () => void {
    if (!Capacitor.isNativePlatform()) return () => {};
    let active = true; let listener: PluginListenerHandle | null = null;
    void Promise.resolve().then(() => App.addListener("appStateChange", state => { if (active) handler(state); }))
      .then(handle => { if (!active) removeListener(handle); else listener = handle; })
      .catch(error => console.error("Unable to observe timer app state:", error));
    return () => { active = false; if (listener) removeListener(listener); };
  },
  async requestNotificationPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display === "prompt" || permission.display === "prompt-with-rationale") permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") return false;
    return (await LocalNotifications.areEnabled()).value;
  },
  async syncTimerNotification(snapshot: TimerNotificationSnapshot): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    return enqueue(async revision => {
      if (revision !== notificationRevision) return;
      if (!snapshot.isRunning || !snapshot.isVisible || !snapshot.bookTitle || !snapshot.userId || !snapshot.clientSessionId) { await clearNativeNotification(); return; }
      const enabled = await LocalNotifications.areEnabled();
      if (revision !== notificationRevision || !enabled.value) return;
      await registerActions();
      if (revision !== notificationRevision) return;
      await LocalNotifications.schedule({ notifications: [{ title: `Reading: ${snapshot.bookTitle}`,
        body: `Timer running: ${formatElapsed(snapshot.elapsedSeconds)}`, id: TIMER_NOTIFICATION_ID,
        schedule: { at: new Date(Date.now() + 1000) }, ongoing: true, sound: undefined,
        attachments: undefined, actionTypeId: TIMER_ACTION_TYPE,
        extra: { bookId: snapshot.bookId, userId: snapshot.userId, clientSessionId: snapshot.clientSessionId } }] });
    });
  },
  async clearTimerNotification(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    return enqueue(async revision => { if (revision === notificationRevision) await clearNativeNotification(); });
  },
  onTimerAction(handler: (action: "stop", identity?: TimerNotificationIdentity) => void): () => void {
    if (!Capacitor.isNativePlatform()) return () => {};
    let active = true; let listener: PluginListenerHandle | null = null;
    void Promise.resolve().then(() => LocalNotifications.addListener("localNotificationActionPerformed", event => {
      const identity = event.notification.extra;
      if (active && event.actionId === "stop" && event.notification.id === TIMER_NOTIFICATION_ID &&
        typeof identity?.userId === "string" && typeof identity?.clientSessionId === "string") {
        handler("stop", { userId: identity.userId, clientSessionId: identity.clientSessionId });
      }
    })).then(handle => { if (!active) removeListener(handle); else listener = handle; })
      .catch(error => console.error("Unable to observe timer notification actions:", error));
    return () => { active = false; if (listener) removeListener(listener); };
  },
};
