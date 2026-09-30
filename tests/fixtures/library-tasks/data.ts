import { useMemo, useSyncExternalStore } from 'react';
import { readAccount, subscribe } from './state';
export * from '../adaptive-shell/data';
export function useAuth() {
  const id = useSyncExternalStore(subscribe, readAccount);
  const user = useMemo(() => id ? { id, email: `${id}@example.invalid`, user_metadata: { full_name: 'Alex Reader' } } : null, [id]);
  return { user, loading: false, signOut: async () => { throw new Error('Sign out is outside this fixture'); } };
}
export const getCurrentAuthUser = async () => readAccount() ? { id: readAccount()! } : null;
