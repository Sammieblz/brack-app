import { useSyncExternalStore } from 'react';
import { getFlags, getReaderId, subscribe } from './state';

export const useAuth = () => {
  const id = useSyncExternalStore(subscribe, getReaderId, getReaderId);
  return { user: id ? { id, email: 'reader@example.invalid' } : null, loading: false };
};
export const useFeatureFlags = () => useSyncExternalStore(subscribe, getFlags, getFlags);
export const useUserProfile = () => ({
  profile: { id: 'fixture-profile', display_name: 'Fixture Reader', bio: 'Synthetic reading profile',
    avatar_url: null, created_at: '2026-01-01T12:00:00Z', profile_visibility: 'public' },
  stats: { totalBooks: 1, booksRead: 0, currentlyReading: 1, badges: 0 },
  gamification: null, loading: false, error: null, refetch: () => undefined,
});
export const useFollowing = () => ({ followersCount: 2, followingCount: 3, isMutual: false, messageEligibility: 'not_mutual', loading: false });
export const useHapticFeedback = () => ({ triggerHaptic: () => undefined });
export const getApiErrorStatus = (error: unknown) => typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined;
export const useReviews = () => ({ createReview: async () => ({ success: true }) });
