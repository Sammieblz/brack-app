import type { Profile, ReadingHabits } from '../../../apps/client/src/types';
import type { NotificationPreferences } from '../../../apps/client/src/services/api/notifications';
import { request, readAccount } from './state';
import { pixel } from './devices';
export * from '../live-composers/api';
export { getCurrentAuthUser } from './data';
const stamp = '2026-10-01T12:00:00.000Z';
let profile: Profile = { id: 'shell-reader', display_name: 'Alex Reader', bio: 'One chapter at a time.', avatar_url: null,
  first_name: 'Alex', last_name: 'Reader', date_of_birth: '1992-06-15', phone_number: '', city: 'Brooklyn', country: 'United States',
  latitude: 40.6782, longitude: -73.9442, show_location: true, color_theme: 'default', theme_mode: 'light', library_view_mode: 'flat',
  profile_visibility: 'public', show_reading_activity: true, show_currently_reading: true, allow_friend_requests: true, is_active: true,
  current_streak: 3, longest_streak: 7, last_reading_date: null, streak_freeze_used_at: null,
  onboarding_status: 'completed', onboarding_version: 1, onboarding_last_step: 'review', onboarding_completed_at: stamp, onboarding_skipped_at: null,
  created_at: stamp, updated_at: stamp };
let habits: ReadingHabits = { id: 'habits-one', user_id: 'shell-reader', avg_time_per_book: 14, genres: ['Fiction'], avg_length: 300,
  books_6mo: 6, books_1yr: 12, longest_genre: 'History', preferred_session_minutes: 20, preferred_reading_time: 'evening',
  reading_frequency: 'daily', motivation: 'A quiet moment each day.', book_format: 'print', created_at: stamp, updated_at: stamp };
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = { push_enabled: true, messages_enabled: true, followers_enabled: true,
  book_clubs_enabled: true, goals_enabled: true, streaks_enabled: true, reading_reminders_enabled: false, badges_enabled: true, quests_enabled: true,
  rank_movement_enabled: true, weekly_results_enabled: true, gold_leaves_enabled: true, quiet_hours_start: '22:00', quiet_hours_end: '07:00' };
let notificationPrefs = { ...DEFAULT_NOTIFICATION_PREFERENCES };
export async function fetchProfile(id: string) { await request('profile-read', { id }); return { ...profile, id }; }
export async function upsertProfileBasics(id: string, updates: Partial<Profile>) { await request('profile-save', { id, ...updates }); profile = { ...profile, ...updates }; }
export async function upsertPersonalInfo(id: string, updates: Partial<Profile>) { await request('personal-save', { id, ...updates }); profile = { ...profile, ...updates }; }
export async function fetchReadingProfile(id: string) { await request('reading-read', { id }); return { habits: { ...habits, user_id: id }, learningProfile: null }; }
export async function upsertReadingHabits(updates: Partial<ReadingHabits>) { await request('reading-save', updates); habits = { ...habits, ...updates }; }
export async function uploadPublicStorageFile(bucket: string, path: string, file: Blob) { await request('avatar-upload', { bucket, path, size: file.size, type: file.type }); return pixel; }
export async function updateProfileAvatar(id: string, url: string) { await request('avatar-save', { id, url }); profile = { ...profile, avatar_url: url }; }
export const removeStorageFiles = async () => undefined;
export async function fetchNotificationPreferences(id: string) { await request('notification-read', { id }); return { ...notificationPrefs }; }
export async function saveNotificationPreferences(id: string, updates: NotificationPreferences) { await request('notification-save', { id, ...updates }); notificationPrefs = { ...updates }; }
export const fetchFollowStats = async () => ({ followersCount: 14, followingCount: 8, isFollowing: false, isFollowedBy: false, isMutual: false, messageEligibility: 'restricted' });
export const subscribeToFollowRelationship = () => () => undefined;
export const followUser = async () => undefined;
export const unfollowUser = async () => undefined;
export const getBlockedUsers = async () => [];
export const unblockUser = async () => undefined;
export async function updatePresence(updates: unknown) { await request('privacy-save', updates); }
export async function updateGamificationSettings(updates: unknown) { await request('privacy-save', updates); }
export const signInWithEmailPassword = async () => ({ user: { id: readAccount() } });
export async function updatePassword(value: string) { await request('password-save', { value }); return { user: { id: readAccount() } }; }
export const fetchThemePreferences = async () => ({ color_theme: 'default', theme_mode: 'light', library_view_mode: 'flat' });
export async function upsertThemePreferences(id: string, updates: unknown) { await request('theme-save', { id, updates }); }
export const THEME_PREFERENCES_CHANGED_EVENT = 'fixture:theme-preferences';
export const supabase = { from: (table: string) => ({
  select: () => ({ eq: (_key: string, id: string) => ({ maybeSingle: async () => { await request('privacy-read', { table, id }); return { data: { ...profile, reader_status: 'available', show_online_status: true }, error: null }; } }) }),
  update: (updates: Partial<Profile>) => ({ eq: async (_key: string, id: string) => {
    try { await request('privacy-save', { table, id, ...updates }); profile = { ...profile, ...updates }; return { error: null }; }
    catch (error) { return { error }; }
  } }),
}) };
export const getOnboardingStatus = async () => ({ onboarding_status: 'completed' });
export const needsSetupPrompt = (status: string | undefined) => status !== 'completed';
export const getOnboardingErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
