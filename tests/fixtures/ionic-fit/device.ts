// Synthetic renderer boundary only: no native plugin or authentication operation.
const params = new URLSearchParams(window.location.search);
export const Capacitor = {
  isNativePlatform: () => params.get('runtime') === 'native',
  getPlatform: () => params.get('runtime') === 'native' ? (params.get('mode') === 'md' ? 'android' : 'ios') : 'web',
  isPluginAvailable: () => false,
};
const unsupported = async () => { throw new Error('Native operation outside Ionic fit fixture'); };
export const Browser = { open: unsupported };
export const AppLauncher = { openUrl: unsupported };
