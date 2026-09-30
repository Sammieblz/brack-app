import { useMemo, useSyncExternalStore } from 'react';
import { readAccount, readOnline, subscribe } from './state';
export * from '../live-composers/data';
export function useAuth() {
  const id = useSyncExternalStore(subscribe, readAccount);
  const user = useMemo(() => id ? { id, email: `${id}@example.invalid`, user_metadata: { full_name: 'Alex Reader' } } : null, [id]);
  return { user, loading: false, signOut: async () => { throw new Error('Sign-out UI is outside this fixture'); } };
}
export const getCurrentAuthUser = async () => readAccount() ? { id: readAccount()! } : null;
export const useNetworkStatus = () => useSyncExternalStore(subscribe, readOnline);
