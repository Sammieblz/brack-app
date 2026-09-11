import { useEffect, useState } from 'react';
import type { Book } from '@/types';
import type { GamificationHomeResponse, LeaderboardEntry } from '@/services/api/gamification';

// Type-only production contracts keep the exercised data realistic without
// importing runtime API clients. All hooks and persistence stay local here.
const noop = () => undefined;
const resolved = async () => undefined;
const user = { id: 'shell-scroll-reader' };
const books: Book[] = Array.from({ length: 30 }, (_, index) => ({
  id: `fixture-book-${index}`, user_id: user.id, title: `Reading collection ${index + 1}`,
  author: 'Fixture author', status: 'reading', pages: 300, current_page: 40,
  genre: 'Fiction', tags: [], shelf_position: index,
  isbn: null, chapters: null, description: null, metadata: null,
  date_started: null, date_finished: null, rating: null, notes: null,
  source_provider: null, source_id: null, deleted_at: null,
  cover_url: '/brack-mark.webp', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}));
export const useAuth = () => ({ user });
export const useBooks = () => ({ books, loading: false, loadingMore: false, hasMore: false,
  loadMore: resolved, refetchBooks: resolved, removeBookLocally: noop, updateBooksLocally: noop });
export const useReadingProfile = () => ({ habits: { genres: [] } });
export const useBadges = () => ({ badges: [], earnedBadges: [], loading: false });
export const useFeatureFlags = () => ({ socialEnabled: true, gamificationEnabled: true, leaderboardsEnabled: true });
export const useHapticFeedback = () => ({ triggerHaptic: noop });
export const useProfileContext = () => ({ profile: { display_name: 'Fixture reader' }, isLoading: false });
export const useTimer = () => ({ startTimer: noop });
export const fetchThemePreferences = async () => ({ library_view_mode: new URLSearchParams(location.search).get('view') ?? 'flat' });
export const upsertThemePreferences = resolved;
export const reorderLibraryShelf = resolved;
export const updateGamificationSettings = resolved;
export const isGamificationFallbackEligible = () => false;
export const isConnectivityAvailable = () => false;
export const bookOperations = { delete: resolved, update: resolved };
export const trackCoreEvent = noop;
export const gamificationQueryKey = () => ['fixture-gamification'];
const journey: GamificationHomeResponse = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  quests: [], tomorrow_quests: [], recent_rewards: [],
  week: { id: 'fixture-week', week_start: '2026-09-07', week_end: '2026-09-14',
    scoring_closes_at: '2026-09-17T12:00:00Z', status: 'active', finalized_at: null },
  account: { user_id: user.id, lifetime_ink: 140, gold_leaves: 0, current_level: 1,
    level_title: 'Fresh Ink', level_threshold: 0, next_level: null,
    leaderboard_opt_in: true, leaderboard_eligible_from: null, gamification_profile_visible: true },
  league: { league_id: 'fixture-league', week_id: 'fixture-week', name: 'Reading circle',
    tier: 1, provisional_rank: 31, score: 140, member_count: 31, status: 'active' },
  server_time: '2026-09-10T12:00:00Z', cached_at: '2026-09-10T12:00:00Z',
};
export const useGamification = () => {
  const [ready, setReady] = useState(() => !new URLSearchParams(location.search).has('loading'));
  useEffect(() => {
    const reveal = () => setReady(true);
    window.addEventListener('fixture:journey-ready', reveal);
    return () => window.removeEventListener('fixture:journey-ready', reveal);
  }, []);
  return { data: ready ? journey : undefined, isLoading: !ready, error: null, provisional: false,
    freshness: 'fresh', isFetching: false, refetch: resolved };
};
const entries: LeaderboardEntry[] = Array.from({ length: 30 }, (_, index) => ({
  user_id: `ranked-reader-${index}`, rank: index + 1, display_name: `Ranked reader ${index + 1}`,
  avatar_url: null, level: 1, level_title: 'Fresh Ink', is_current_user: false,
  competitive_ink: 1000 - index, quests_completed: 3, qualifying_minutes: 100, reading_days: 4,
}));
export const useLeaderboard = () => ({ data: { entries }, isLoading: false, isFetching: false, error: null, refetch: resolved });
