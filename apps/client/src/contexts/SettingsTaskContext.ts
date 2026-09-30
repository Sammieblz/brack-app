import { createContext, useContext, useLayoutEffect, useRef } from "react";

export type SettingsTaskState = { dirty: boolean; pending: boolean };
export type SettingsLeave = (action: () => void) => Promise<void>;
export type SettingsSignOut = (beforeOpen?: () => void) => Promise<void>;
type SettingsTask = {
  register: (read: () => SettingsTaskState) => () => void;
  leave: SettingsLeave;
  registerSignOut: (action: () => void) => () => void;
  signOut: SettingsSignOut;
};
export const SettingsTaskContext = createContext<SettingsTask | null>(null);
const leaveDirectly: SettingsLeave = async (action) => { action(); };

/** Optional so existing standalone consumers keep their own navigation contract. */
export function useSettingsTask(state: SettingsTaskState): void {
  const context = useContext(SettingsTaskContext);
  const latest = useRef(state);
  latest.current = state;
  const register = context?.register;
  useLayoutEffect(() => register?.(() => latest.current), [register]);
}

export function useSettingsLeave(): SettingsLeave {
  return useContext(SettingsTaskContext)?.leave ?? leaveDirectly;
}

export function useSettingsSignOut(): SettingsSignOut | undefined {
  return useContext(SettingsTaskContext)?.signOut;
}

export function useRegisterSettingsSignOut(action: () => void): void {
  const register = useContext(SettingsTaskContext)?.registerSignOut;
  const latest = useRef(action);
  latest.current = action;
  useLayoutEffect(() => register?.(() => latest.current()), [register]);
}
