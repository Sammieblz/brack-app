import type { AppStateChange, TimerNotificationSnapshot } from '../../../apps/client/src/services/timerNative';
type PermissionMode = 'granted' | 'denied' | 'reject' | 'defer';
type NotificationIdentity = { userId: string; clientSessionId: string };
type OwnedNotificationSnapshot = TimerNotificationSnapshot & Partial<NotificationIdentity>;
let permission: PermissionMode = 'granted';
let requests = 0;
let cleared = 0;
const pending: Array<(granted: boolean) => void> = [];
const appHandlers = new Set<(state: AppStateChange) => void>();
const actionHandlers = new Set<(action: 'stop', identity?: NotificationIdentity) => void>();
const notifications: OwnedNotificationSnapshot[] = [];
export const timerNativeService = {
  isNative: () => ['ios', 'android'].includes(new URLSearchParams(location.search).get('runtime') ?? ''),
  onAppStateChange: (handler: (state: AppStateChange) => void) => { appHandlers.add(handler); return () => { appHandlers.delete(handler); }; },
  onTimerAction: (handler: (action: 'stop', identity?: NotificationIdentity) => void) => { actionHandlers.add(handler); return () => { actionHandlers.delete(handler); }; },
  requestNotificationPermissions: async () => {
    requests += 1;
    if (permission === 'reject') throw new Error('Fixture notification permission failed');
    if (permission === 'defer') return new Promise<boolean>(resolve => pending.push(resolve));
    return permission === 'granted';
  },
  syncTimerNotification: async (snapshot: OwnedNotificationSnapshot) => { notifications.push(structuredClone(snapshot)); },
  clearTimerNotification: async () => { cleared += 1; },
};
export const nativeControls = {
  configurePermission: (mode: PermissionMode) => { permission = mode; },
  settlePermission: (granted: boolean) => {
    const resolve = pending.shift(); if (!resolve) throw new Error('No pending notification permission'); resolve(granted);
  },
  appState: (isActive: boolean) => { appHandlers.forEach(handler => handler({ isActive })); },
  stop: (identity?: NotificationIdentity | null) => {
    const last = notifications[notifications.length - 1];
    const owned = identity === null ? undefined : identity ?? (last?.userId && last?.clientSessionId ? { userId: last.userId, clientSessionId: last.clientSessionId } : undefined);
    actionHandlers.forEach(handler => handler('stop', owned));
  },
  snapshot: () => ({ requests, cleared, pendingPermissions: pending.length, notifications: structuredClone(notifications),
    appListeners: appHandlers.size, actionListeners: actionHandlers.size }),
};
