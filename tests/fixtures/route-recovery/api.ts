import { controls } from './data';
import { readAccount } from '../library-tasks/state';
import type { Goal } from '../../../apps/client/src/types';
import { getClubDetail as readClub } from '../live-composers/api';
export * from '../library-tasks/api';
export { getClubsHome } from '../social-destinations/api';
let clubMode = new URLSearchParams(location.search).get('club') ?? 'ready';
const clubWaiters: Array<() => void> = [];
export const setClubMode = (mode: string) => { clubMode = mode; clubWaiters.splice(0).forEach(resolve => resolve()); };
export const getClubDetail = async () => {
  if (clubMode === 'loading') await new Promise<void>(resolve => clubWaiters.push(resolve));
  if (clubMode === 'empty') return null;
  if (clubMode !== 'ready') throw Object.assign(new Error('Fixture club unavailable'), { status: Number(clubMode) || 503 });
  return readClub();
};
export const fetchGoals = async (id: string): Promise<Goal[]> => [{
  id: `goal-${id}`, user_id: id, target_books: id === 'shell-reader' ? 7 : 12, target_minutes: null, target_pages: null,
  goal_type: 'books_count', period_type: 'yearly', is_active: true, is_completed: false, completed_at: null,
  start_date: '2026-01-01', end_date: '2026-12-31', reminder_time: null, created_at: '2026-01-01T12:00:00Z', updated_at: null, deleted_at: null,
}];
const unsupported = async () => { throw new Error('Mutation outside route-recovery fixture'); };
export const createGoal = unsupported, updateGoal = unsupported, deleteGoal = unsupported, completeGoal = unsupported;
export const signInWithEmailPassword = async () => { controls.setAuth('shell-reader'); };
export const signInWithOAuth = unsupported, signUpWithEmail = unsupported, resendSignUpEmail = unsupported,
  sendPasswordResetEmail = unsupported, verifyEmailOtp = unsupported, handleAuthCallbackUrl = unsupported;
export const ensureUserProfile = async () => ({ onboarding_status: 'completed' });
export const shouldEnterFirstRunOnboarding = () => false;
export const isOnboardingBackendUnavailable = () => false;
export const getCurrentAuthUser = async () => readAccount() ? { id: readAccount()!, created_at: '2025-01-01T00:00:00Z' } : null;
export const skipOnboarding = unsupported, saveOnboardingProfile = unsupported;
