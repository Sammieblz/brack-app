import { useMemo } from 'react';
import * as dashboard from '../reading-progress/dashboard';
import type { DashboardHomeResponse, DashboardJourneySummary } from '../../../apps/client/src/services/api/dashboard';
import type { GamificationHomeResponse, QuestAssignment } from '../../../apps/client/src/services/api/gamification';
export { gamificationQueryKey } from '../library-tasks/data';
const params = new URLSearchParams(location.search);
const enabled = params.has('timerQuest') || params.has('streakEntry');
const stamp = new Date().toISOString();
const today = stamp.slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
function timerQuest(): QuestAssignment {
  return { id: 'fixture-reading-time', title: 'Make time for a chapter', description: 'Spend a little time with your current book.',
    metric: 'reading_minutes', cadence: 'daily', target_value: 20, progress_value: 2,
    reward_ink: 10, reward_gold_leaves: 0, status: 'active', period_start: today, period_end: today, completed_at: null };
}
function home(userId: string): GamificationHomeResponse {
  return { account: { user_id: userId, lifetime_ink: 40, gold_leaves: 2, current_level: 1, level_title: 'Reader', level_threshold: 0,
    next_level: { level: 2, title: 'Book explorer', ink_threshold: 100 }, leaderboard_opt_in: false,
    leaderboard_eligible_from: null, gamification_profile_visible: false }, quests: [timerQuest()], tomorrow_quests: [], recent_rewards: [], league: null,
    week: { id: 'fixture-week', week_start: today, week_end: today, scoring_closes_at: `${today}T23:59:59Z`, status: 'active', finalized_at: null },
    server_time: stamp, timezone: 'UTC', source: 'live', cached_at: stamp };
}
export function useGamification(userId?: string) {
  const data = useMemo(() => userId ? home(userId) : null, [userId]);
  return { data, isLoading: false, isFetching: false, error: null, provisional: false, freshness: 'live' as const, refetch: async () => undefined };
}
export const useLeaderboard = () => ({ data: { entries: [] }, isLoading: false, isFetching: false, error: null, refetch: async () => undefined });
export const useGamificationShop = () => { throw new Error('Journey shop is outside the reading session fixture'); };
export function useDashboardHomeData(userId?: string) {
  const ordinary = dashboard.useDashboardHomeData(userId);
  const journey: DashboardJourneySummary | null = useMemo(() => userId ? { ...home(userId), streak_freeze: null, latest_milestone: null } : null, [userId]);
  if (!enabled) return ordinary;
  const dashboardHome: DashboardHomeResponse | null = params.has('streakEntry') ? {
    continueBooks: ordinary.primaryBook ? [ordinary.primaryBook] : [], activeGoal: null,
    today: { minutes: 0, sessionCount: 0, progressLogCount: 0 },
    streak: { currentStreak: 3, longestStreak: 7, lastReadingDate: yesterday, freezeUsedAt: null },
    stats: { totalBooks: 3, completedBooks: 0, readingBooks: 3, toReadBooks: 0, pagesRead: 42, readingMinutes: 30 },
    recentActivity: [], achievements: [], journey,
  } : null;
  return { ...ordinary, dashboardHome, journey, journeyFreshness: 'live' as const, hasCurrentSessionLiveResponse: true };
}
export const useFeatureFlags = () => ({ ...dashboard.useFeatureFlags(), gamificationEnabled: enabled || dashboard.useFeatureFlags().gamificationEnabled });
