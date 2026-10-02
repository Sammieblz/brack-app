import { useSyncExternalStore } from 'react';
import { getTheme } from '@/lib/themes';
import { useBooks as readFixtureCollection } from '../shell-scroll/data';
export { useBooks, useReadingProfile, useBadges, useGamification, useLeaderboard,
  fetchThemePreferences, upsertThemePreferences, reorderLibraryShelf, updateGamificationSettings,
  isGamificationFallbackEligible, isConnectivityAvailable, getApiErrorStatus,
  trackCoreEvent, gamificationQueryKey } from '../shell-scroll/data';

const params = new URLSearchParams(location.search);
const noop = () => undefined;
const resolved = async () => undefined;
const rejectWrite = async () => { throw new Error('Persistence is outside the adaptive-shell fixture'); };
export const bookOperations = { create: rejectWrite, delete: rejectWrite, update: rejectWrite };
const user = { id: 'shell-reader', email: 'reader@example.invalid', user_metadata: { full_name: 'Alex Reader' } };
export const useAuth = () => ({ user, loading: false, signOut: rejectWrite });
export const getCurrentAuthUser = async () => user;
export const isBookAlreadyExistsError = () => false;
export const searchBooks = async () => ({ books: [] });
export const fetchBookById = async () => ({ ...readFixtureCollection().books[0] });
export const booksRepo = { get: async (id: string) => readFixtureCollection().books.find(book => book.id === id) ?? null,
  upsertRemoteManyPreservingLocal: async (_userId: string, books: unknown[]) => books };
export const createLocalId = () => `fixture-cover-${Date.now()}`;
export const uploadPublicStorageFile = rejectWrite;
export const useJournalEntries = () => ({ entries: [], addEntry: rejectWrite });
export const useImagePicker = () => ({ picking: false, pickImage: rejectWrite, pickFromCamera: rejectWrite,
  pickFromPhotos: rejectWrite, pickWithPrompt: rejectWrite });
export const useBarcodeScanner = () => ({ isScanning: false, scannedCode: null, error: null,
  startScan: rejectWrite, stopScan: noop, resetScan: noop });
export const addScannedBookToLibrary = rejectWrite;
export const resolveScannedBook = rejectWrite;
export class ScannedBookNoMatchError extends Error {}
export class ScannerConnectivityError extends Error {}
export const useProfileContext = () => ({ profile: { display_name: 'Alex Reader', avatar_url: null }, isLoading: false });
export const useFeatureFlags = () => ({ socialEnabled: params.get('social') !== 'off', gamificationEnabled: true, leaderboardsEnabled: true });
export const useHapticFeedback = () => ({ triggerHaptic: noop });
export const useFollowing = () => ({ followersCount: 14, followingCount: 8 });
export const useConversations = () => ({ conversations: [] });
export const useStreaks = () => ({ streakData: { currentStreak: 4, longestStreak: 7 }, loading: false });
export const useBookLists = () => ({ lists: [], addBookToList: rejectWrite, removeBookFromList: rejectWrite });
export const fetchListIdsContainingBook = async () => [];
export const imageCache = { getCachedImage: async (url: string) => url, cacheImage: async (url: string) => url };
export const useUserNotifications = () => ({ userId: user.id, notifications: [], hasData: true, unread: 0,
  pendingRead: false, readError: null, readSucceeded: false, markRead: resolved,
  query: { isPending: false, isFetching: false, isError: false, isSuccess: true, fetchStatus: 'idle', refetch: resolved } });

let mode = params.get('theme') === 'dark' ? 'dark' : 'light';
const themeSubscribers = new Set<() => void>();
const subscribeTheme = (callback: () => void) => { themeSubscribers.add(callback); return () => { themeSubscribers.delete(callback); }; };
export function applyFixtureTheme(next = mode) {
  mode = next;
  const theme = getTheme(params.get('palette') ?? 'default');
  document.documentElement.classList.toggle('dark', mode === 'dark');
  const colors = mode === 'dark' ? theme.colors.dark : theme.colors.light;
  for (const [key, value] of Object.entries(colors)) {
    document.documentElement.style.setProperty(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/chart(\d+)/g, 'chart-$1')}`, value);
  }
  const style = theme.surfaceStyle ?? 'standard';
  document.documentElement.dataset.brackThemeStyle = style;
  for (const candidate of ['standard', 'paper', 'glass', 'comic', 'coloring-book']) {
    document.documentElement.classList.toggle(`brack-theme-${candidate}`, candidate === style);
  }
  for (const [key, value] of Object.entries({ background: colors.card, foreground: colors.cardForeground,
    primary: colors.primary, 'primary-foreground': colors.primaryForeground, accent: colors.accent,
    'accent-foreground': colors.accentForeground, border: colors.border, ring: colors.ring })) {
    document.documentElement.style.setProperty(`--sidebar-${key}`, value);
  }
  themeSubscribers.forEach((callback) => callback());
}
export function useTheme() {
  const current = useSyncExternalStore(subscribeTheme, () => mode);
  return { currentTheme: params.get('palette') ?? 'default', resolvedTheme: current, themeMode: current,
    setThemeMode: async (next: string) => applyFixtureTheme(next), isLoading: false };
}

type TimerState = { time: number; isRunning: boolean; isVisible: boolean; isMinimized: boolean; bookTitle: string };
let timer: TimerState = { time: 1325, isRunning: params.has('timer'), isVisible: params.has('timer'),
  isMinimized: true, bookTitle: 'Reading collection 1' };
const timerSubscribers = new Set<() => void>();
const subscribeTimer = (callback: () => void) => { timerSubscribers.add(callback); return () => { timerSubscribers.delete(callback); }; };
let finished = 0;
let cancelled = 0;
function setTimer(next: Partial<TimerState>) { timer = { ...timer, ...next }; timerSubscribers.forEach((callback) => callback()); }
export function useTimer() {
  const current = useSyncExternalStore(subscribeTimer, () => timer);
  return { ...current, bookId: 'fixture-book-0',
    startTimer: (_id: string, title: string) => setTimer({ isVisible: true, isRunning: true, bookTitle: title, time: 0 }),
    pauseTimer: () => setTimer({ isRunning: false }), resumeTimer: () => setTimer({ isRunning: true }),
    finishTimer: async () => {
      finished++;
      // Match the provider's ordering: prompt event during save, then hide the
      // timer when the awaited save resolves. No record is persisted here.
      if (params.has('journalPrompt')) {
        window.dispatchEvent(new CustomEvent('showJournalPrompt', { detail: {
          userId: user.id, bookId: 'fixture-book-0', bookTitle: timer.bookTitle, durationMinutes: timer.time / 60,
        } }));
        await Promise.resolve();
      }
      setTimer({ isVisible: false, isRunning: false });
    },
    cancelTimer: () => { cancelled++; setTimer({ isVisible: false, isRunning: false }); },
    toggleMinimized: () => setTimer({ isMinimized: !timer.isMinimized }) };
}
export const useNetworkStatus = () => !params.has('offline');
export const SYNC_STATUS_EVENT = 'fixture:sync-status';
const syncStatus = { pending: params.has('offline') ? 2 : 0, failed: params.has('failedSync') ? 1 : 0, syncing: 0 };
export const readingCoreSync = { getStatus: async () => syncStatus, syncCurrentUser: async () => syncStatus,
  listFailedCurrentUser: async () => [], getServerBookCopySafety: rejectWrite,
  retryFailedItem: rejectWrite, discardFailedItem: rejectWrite, useServerBookCopy: rejectWrite };
export const fixtureData = { snapshot: () => ({ timer, finished, cancelled }), setTimer };
