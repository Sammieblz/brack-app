import { useEffect, useState } from 'react';
import { Sidebar, SidebarContent, SidebarTrigger } from '@/components/ui/sidebar';
import { JourneyLeague as RealJourneyLeague } from '../../../apps/client/src/components/journey/JourneyLeague';

// Only data/remote side effects and unrelated overlays are replaced. The routed
// screens, layout, headers, scroll utilities, tabs and library views stay real.
const noop = () => undefined;
const resolved = async () => undefined;
const user = { id: 'shell-scroll-reader' };
const books = Array.from({ length: 30 }, (_, index) => ({
  id: `fixture-book-${index}`, user_id: user.id, title: `Reading collection ${index + 1}`,
  author: 'Fixture author', status: 'reading', pages: 300, current_page: 40,
  genre: 'Fiction', tags: [], shelf_position: index,
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
const journey = { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, quests: [], tomorrow_quests: [],
  week: { id: 'fixture-week', scoring_closes_at: '2026-09-17T12:00:00Z' },
  account: { leaderboard_opt_in: true, level_title: 'Fresh Ink', leaderboard_eligible_from: null },
  league: { name: 'Reading circle', tier: 1, provisional_rank: 31, score: 140, member_count: 31, status: 'active' },
  server_time: '2026-09-10T12:00:00Z', cached_at: '2026-09-10T12:00:00Z' };
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
const entries = Array.from({ length: 30 }, (_, index) => ({
  user_id: `ranked-reader-${index}`, rank: index + 1, display_name: `Ranked reader ${index + 1}`,
  avatar_url: null, level_title: 'Fresh Ink', is_current_user: false,
  competitive_ink: 1000 - index, quests_completed: 3, qualifying_minutes: 100, reading_days: 4,
}));
export const useLeaderboard = () => ({ data: { entries }, isLoading: false, isFetching: false, error: null, refetch: resolved });

export function AppSidebar() {
  return <Sidebar collapsible="icon"><SidebarContent><SidebarTrigger aria-label="Toggle sidebar" /></SidebarContent></Sidebar>;
}
export const HeaderTimerWidget = () => <button type="button" aria-label="Reading timer" className="h-10 w-10 rounded-full">◷</button>;
export const UserNotificationsPopover = () => <button type="button" aria-label="Notifications" className="h-10 w-10 rounded-full">•</button>;
export const ProfileDrawer = () => null;
export const AddToListDialog = () => null;
export const BadgeDetailsDialog = () => null;
export const FloatingActionButton = () => null;
export const JourneyFreshnessNotice = () => null;
export const JourneyQuestBookPicker = () => null;

function JourneyContent() {
  const [late, setLate] = useState(false);
  return <div data-fixture-journey-content>
    <button type="button" onClick={() => setLate(true)}>Load additional reading history</button>
    {Array.from({ length: late ? 25 : 15 }, (_, index) => <article key={index} className="min-h-32 border-b p-6">
      <h2 className="font-display text-2xl">Reading milestone {index + 1}</h2>
      <p>Your progress remains anchored while the header stays in place.</p>
    </article>)}
  </div>;
}
export const JourneyOverview = JourneyContent;
export const JourneyQuests = JourneyContent;
export const JourneyShop = JourneyContent;
export const JourneyBadges = JourneyContent;
export const JourneyLeague = RealJourneyLeague;
