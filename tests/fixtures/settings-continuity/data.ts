import { useMemo, useSyncExternalStore } from 'react';
import { controls, readAccount, readAuthLoading, request, subscribe } from './state';
export * from '../live-composers/data';
export function useAuth() {
  const id = useSyncExternalStore(subscribe, readAccount);
  const loading = useSyncExternalStore(subscribe, readAuthLoading);
  const user = useMemo(() => id ? { id, email: `${id}@example.invalid`, app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: 'Alex Reader' } } : null, [id]);
  return { user, loading, signOut: async () => { await request('sign-out', {}); controls.setAccount(null); } };
}
export const getCurrentAuthUser = async () => readAccount() ? { id: readAccount()! } : null;
