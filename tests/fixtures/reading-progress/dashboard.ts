import { useEffect, useRef, useState } from 'react';
import type { Book } from '../../../apps/client/src/types';
import type { DashboardBookCandidate, DashboardJourneySummary } from '../../../apps/client/src/services/api/dashboard';
import { booksRepo } from './api';
const dailyFocus = new URLSearchParams(location.search).has('dailyFocus');
const stamp = new Date().toISOString();
const today = stamp.slice(0, 10);
function journey(userId: string): DashboardJourneySummary {
  return {
    account: { user_id: userId, lifetime_ink: 40, gold_leaves: 2, current_level: 1, level_title: 'Reader', level_threshold: 0,
      next_level: { level: 2, title: 'Book explorer', ink_threshold: 100 }, leaderboard_opt_in: false, leaderboard_eligible_from: null, gamification_profile_visible: false },
    quests: [{ id: 'daily-pages', title: 'A few more pages', description: 'Log your next reading progress.', cadence: 'daily', metric: 'pages_read',
      target_value: 20, progress_value: 4, reward_ink: 10, reward_gold_leaves: 0, status: 'active', period_start: today, period_end: today, completed_at: null }],
    league: null, week: { id: 'fixture-week', week_start: today, week_end: today, scoring_closes_at: `${today}T23:59:59Z`, status: 'active', finalized_at: null },
    server_time: stamp, timezone: 'UTC', streak_freeze: null, latest_milestone: null, recent_rewards: [],
  };
}
export function useDashboardHomeData(userId?: string) {
  const [book, setBook] = useState<Book | null>(null);
  const owner = useRef(userId);
  owner.current = userId;
  useEffect(() => {
    let active = true;
    setBook(null);
    void booksRepo.get('book-1').then(value => { if (active && value?.user_id === userId) setBook(value); });
    return () => { active = false; };
  }, [userId]);
  const ownedBook = book?.user_id === userId ? book : null;
  const primaryBook: DashboardBookCandidate | null = ownedBook ? { book: ownedBook, progressPercent: 14,
    lastActivityAt: ownedBook.updated_at ?? stamp, lastActivityType: 'book_update', ctaLabel: 'Continue reading' } : null;
  return { dashboardHome: null, journey: dailyFocus && userId ? journey(userId) : null, primaryBook,
    secondaryBooks: [], loading: !ownedBook, fetching: false, error: null, journeyError: null, refetch: async () => {
      const value = await booksRepo.get('book-1');
      if (owner.current === userId && value?.user_id === userId) setBook(value);
    },
    source: 'live' as const, cachedAt: stamp, journeyFreshness: dailyFocus ? 'live' as const : 'unavailable' as const,
    hasCurrentSessionLiveResponse: dailyFocus, canMutateEconomy: false, provisional: false };
}
export const useFeatureFlags = () => ({ gamificationEnabled: dailyFocus, socialEnabled: true, leaderboardsEnabled: false });
export const useOnboardingStatus = () => ({ status: { onboarding_status: 'completed' } });
export const useConfirmedRewardFeedback = () => undefined;
export const useStreakCelebration = () => ({ isOpen: false, streak: 0, dismiss: () => undefined });
export const useGoals = () => ({ goals: [], activeGoals: [], loading: false, refreshing: false, hasLoaded: true, error: null, refetch: async () => undefined });
