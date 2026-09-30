import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { MobileAlertDialog } from "@/components/ui/mobile-dialog";
import { useAppBackGuard } from "@/hooks/useAppBackGuard";
import { SettingsTaskContext, type SettingsTaskState, type SettingsLeave, type SettingsSignOut } from "./SettingsTaskContext";

/** One mounted Settings editor owns its draft. Browser history remains browser-owned. */
export function SettingsTaskProvider({ children }: { children: ReactNode }) {
  const [confirming, setConfirming] = useState(false);
  const answer = useRef<((accepted: boolean) => void) | null>(null);
  const restoreConfirmationFocus = useRef(true);
  const location = useLocation();
  const tasks = useRef(new Set<() => SettingsTaskState>());
  const generation = useRef(0);
  const checking = useRef(false);
  const signOutAction = useRef<(() => void) | null>(null);
  const registerSignOut = useCallback((action: () => void) => {
    signOutAction.current = action;
    return () => { if (signOutAction.current === action) signOutAction.current = null; };
  }, []);
  useLayoutEffect(() => {
    generation.current += 1;
    setConfirming(false);
    return () => {
      generation.current += 1;
      answer.current?.(false);
      answer.current = null;
    };
  }, [location.key]);
  const register = useCallback((read: () => SettingsTaskState) => {
    tasks.current.add(read);
    return () => { tasks.current.delete(read); };
  }, []);
  const canLeave = useCallback(async () => {
    if (checking.current) return false;
    const states = [...tasks.current].map(read => read());
    if (states.some(state => state.pending)) return false;
    if (!states.some(state => state.dirty)) return true;
    checking.current = true;
    const current = generation.current;
    try {
      const accepted = await new Promise<boolean>(resolve => {
        restoreConfirmationFocus.current = true;
        answer.current = resolve;
        setConfirming(true);
      });
      return accepted && current === generation.current &&
        ![...tasks.current].some(read => read().pending);
    } finally { checking.current = false; }
  }, []);
  useAppBackGuard(true, canLeave);
  const leave = useCallback<SettingsLeave>(async (action) => {
    const current = generation.current;
    if (await canLeave() && current === generation.current) action();
  }, [canLeave]);
  const signOut = useCallback<SettingsSignOut>(beforeOpen => leave(() => {
    if (!signOutAction.current) return;
    beforeOpen?.();
    signOutAction.current();
  }), [leave]);
  const finish = (accepted: boolean) => {
    // MobileAlertDialog also requests close after invoking onConfirm; do not
    // replace a resolved acceptance with the following no-op close callback.
    if (!answer.current) return;
    restoreConfirmationFocus.current = !accepted;
    answer.current?.(accepted);
    answer.current = null;
    setConfirming(false);
  };
  return <SettingsTaskContext.Provider value={{ register, leave, registerSignOut, signOut }}>
    {children}
    <MobileAlertDialog open={confirming} onOpenChange={open => { if (!open) finish(false); }}
      restoreFocusOnClose={restoreConfirmationFocus.current}
      title="Discard unsaved changes?"
      description="Your changes have not been saved. Keep editing to retain them."
      confirmText="Discard changes" cancelText="Keep editing" variant="destructive"
      onConfirm={() => finish(true)} />
  </SettingsTaskContext.Provider>;
}

