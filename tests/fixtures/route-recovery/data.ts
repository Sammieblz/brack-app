import { useSyncExternalStore } from 'react';
import { controls as library, subscribe } from '../library-tasks/state';
import { useAuth as useBaseAuth, useTheme as useBaseTheme } from '../library-tasks/data';
export * from '../library-tasks/data';
let loading = new URLSearchParams(location.search).has('resolving');
if (new URLSearchParams(location.search).has('anonymous')) library.setAccount(null);
export function useAuth() {
  const auth = useBaseAuth();
  const resolving = useSyncExternalStore(subscribe, () => loading);
  return { ...auth, loading: resolving };
}
const noop = () => undefined;
export function useTheme() { return { ...useBaseTheme(), previewTheme: noop, resetToDefaultTheme: noop }; }
export const controls = { ...library, setAuth: (id: string | null, resolving = false) => { loading = resolving; library.setAccount(id); } };
