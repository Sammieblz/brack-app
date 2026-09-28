/** Synthetic plugin boundaries only; overlay, focus and viewport code remain real. */
const requestedRuntime = new URLSearchParams(window.location.search).get('runtime');
const runtime = requestedRuntime === 'android' || requestedRuntime === 'ios' ? requestedRuntime : 'web';
export const Capacitor = {
  isNativePlatform: () => runtime !== 'web',
  getPlatform: () => runtime,
  isPluginAvailable: () => false,
};
const noop = async () => undefined;
export const Haptics = { impact: noop, notification: noop, selectionStart: noop, selectionChanged: noop, selectionEnd: noop };
export const ImpactStyle = { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' };
export const NotificationType = { Success: 'SUCCESS', Error: 'ERROR' };
export const Browser = { open: noop, close: noop };
export const AppLauncher = { openUrl: noop, canOpenUrl: async () => ({ value: false }) };
