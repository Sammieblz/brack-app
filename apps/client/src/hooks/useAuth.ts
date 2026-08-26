import { useCallback, useSyncExternalStore } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  clearVerifiedAuthUserCache,
  getAuthSession,
  onAuthStateChange,
  signOut as signOutUser,
} from "@/services/api";
import type { User } from "@/types";

type AuthSnapshot = {
  user: User | null;
  loading: boolean;
};

const listeners = new Set<() => void>();
let snapshot: AuthSnapshot = { user: null, loading: true };
let initializationStarted = false;
let authEventRevision = 0;

const publish = (next: AuthSnapshot) => {
  if (snapshot.user === next.user && snapshot.loading === next.loading) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
};

const applySession = (event: AuthChangeEvent | "BOOTSTRAP", session: Session | null) => {
  if (event !== "BOOTSTRAP") authEventRevision += 1;

  if (
    event === "SIGNED_OUT" ||
    event === "TOKEN_REFRESHED" ||
    event === "USER_UPDATED"
  ) {
    clearVerifiedAuthUserCache();
  }

  publish({ user: session?.user ?? null, loading: false });
};

const initializeAuthStore = () => {
  if (initializationStarted) return;
  initializationStarted = true;

  // One application-wide listener replaces the previous listener per hook
  // instance. Subscribe before reading storage so an intervening Auth event
  // cannot be overwritten by a stale bootstrap result.
  onAuthStateChange((event, session) => {
    applySession(event, session);
  });

  const revisionAtStart = authEventRevision;
  getAuthSession()
    .then((session) => {
      if (authEventRevision === revisionAtStart) {
        applySession("BOOTSTRAP", session);
      }
    })
    .catch((error) => {
      console.error("Unable to restore the local authentication session:", error);
      if (authEventRevision === revisionAtStart) {
        applySession("BOOTSTRAP", null);
      }
    });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  initializeAuthStore();
  return () => listeners.delete(listener);
};

const getSnapshot = () => snapshot;

const signOut = async () => {
  await signOutUser();
  // Clear cached presentation preferences only after sign-out succeeds.
  localStorage.removeItem("color_theme");
  localStorage.removeItem("theme-mode");
  localStorage.removeItem("brack_public_theme_mode_touched");
};

export const useAuth = () => {
  const auth = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const stableSignOut = useCallback(signOut, []);

  return {
    ...auth,
    signOut: stableSignOut,
  };
};
