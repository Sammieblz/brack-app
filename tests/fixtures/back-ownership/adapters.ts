/** Synthetic Capacitor boundary. Navigation, history and overlay code remain real. */
const params = new URLSearchParams(window.location.search);
const runtime = params.get('runtime') === 'android' ? 'android' : params.get('runtime') === 'ios' ? 'ios' : 'web';
const listeners = new Set<() => void>();
const registrations: Array<() => void> = [];
let delayed = params.has('delayNativeRegistration');
let added = 0;
let removed = 0;
let minimized = 0;

export const Capacitor = {
  isNativePlatform: () => runtime !== 'web',
  getPlatform: () => runtime,
  isPluginAvailable: () => false,
};

export const App = {
  addListener: async (name: string, callback: () => void) => {
    if (name !== 'backButton') throw new Error(`Unexpected fixture listener: ${name}`);
    added += 1;
    listeners.add(callback);
    const handle = { remove: async () => { if (listeners.delete(callback)) removed += 1; } };
    if (!delayed) return handle;
    return new Promise<typeof handle>((resolve) => registrations.push(() => resolve(handle)));
  },
  minimizeApp: async () => { minimized += 1; },
};

export const nativeBridge = {
  snapshot: () => ({ runtime, active: listeners.size, added, removed, minimized }),
  emitBack: () => [...listeners].forEach((callback) => callback()),
  releaseRegistration: () => { delayed = false; registrations.splice(0).forEach((resolve) => resolve()); },
};

const noop = async () => undefined;
export const Haptics = { impact: noop, notification: noop, selectionStart: noop, selectionChanged: noop, selectionEnd: noop };
export const ImpactStyle = { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' };
export const NotificationType = { Success: 'SUCCESS', Error: 'ERROR' };
// Imported lazily by the real platform service; external opening is outside this fixture.
export const Browser = { open: noop, close: noop };
export const AppLauncher = { openUrl: noop, canOpenUrl: async () => ({ value: false }) };
