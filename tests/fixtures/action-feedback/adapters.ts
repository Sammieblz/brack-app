import { candidate, create, library, pluginAvailable, recordHaptic, runtime } from './state';
export const getCurrentAuthUser = async () => ({ id: 'fixture-reader' });
export const isBookAlreadyExistsError = (error: { code?: string }) => error.code === 'book_exists';
export const searchBooks = async () => ({ books: [candidate] });
export const bookOperations = { create };
export { booksRepo } from './state';
export const useBooks = () => ({ books: library });
export const useReadingProfile = () => ({ habits: null });
export const Capacitor = {
  isNativePlatform: () => runtime === 'ios' || runtime === 'android',
  getPlatform: () => runtime,
  isPluginAvailable: () => pluginAvailable,
};
export const ImpactStyle = { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' };
export const NotificationType = { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' };
// Platform service dynamic imports must stay inside the synthetic device boundary.
const unsupported = async () => { throw new Error('External launch is outside this fixture'); };
export const Browser = { open: unsupported };
export const AppLauncher = { openUrl: unsupported, canOpenUrl: unsupported };
export const Haptics = {
  impact: (options: unknown) => recordHaptic('impact', options),
  notification: (options: unknown) => recordHaptic('notification', options),
  selectionStart: () => recordHaptic('selectionStart'),
  selectionChanged: () => recordHaptic('selectionChanged'),
  selectionEnd: () => recordHaptic('selectionEnd'),
};
