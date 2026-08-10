import { useEffect, useState } from "react";
import { toast } from "sonner";
import { readingCoreSync } from "@/services/sync/engine";
import {
  CONNECTIVITY_STATE_EVENT,
  getConnectivityState,
  initializeConnectivityMonitoring,
} from "@/services/connectivity";
import type { ConnectivityState } from "@/types";

const CONNECTIVITY_TOAST_ID = "brack-connectivity-state";

let notificationReferences = 0;
let notificationCleanup: (() => void) | null = null;
let pendingRecoverySync: number | null = null;

const clearPendingRecoverySync = () => {
  if (pendingRecoverySync === null) return;
  window.clearTimeout(pendingRecoverySync);
  pendingRecoverySync = null;
};

const initializeConnectivityNotifications = () => {
  notificationReferences += 1;
  if (notificationCleanup) {
    return () => {
      notificationReferences = Math.max(0, notificationReferences - 1);
      if (notificationReferences === 0) {
        notificationCleanup?.();
        notificationCleanup = null;
      }
    };
  }

  let previousState = getConnectivityState();
  const handleState = (event: Event) => {
    const nextState = (event as CustomEvent<ConnectivityState>).detail;
    if (nextState === previousState) return;

    if (nextState === "online") {
      if (previousState === "offline" || previousState === "degraded") {
        toast.success("Back online", { id: CONNECTIVITY_TOAST_ID });
        clearPendingRecoverySync();
        pendingRecoverySync = window.setTimeout(() => {
          pendingRecoverySync = null;
          void readingCoreSync.syncCurrentUser().catch(console.error);
        }, 500);
      } else {
        toast.dismiss(CONNECTIVITY_TOAST_ID);
      }
    } else if (nextState === "offline") {
      clearPendingRecoverySync();
      toast.info("You're offline. Reading changes will save locally and sync later.", {
        id: CONNECTIVITY_TOAST_ID,
      });
    } else if (nextState === "degraded") {
      clearPendingRecoverySync();
      toast.info("Connection is limited. Reading changes are being saved locally.", {
        id: CONNECTIVITY_TOAST_ID,
      });
    } else {
      clearPendingRecoverySync();
      toast.dismiss(CONNECTIVITY_TOAST_ID);
    }

    previousState = nextState;
  };

  window.addEventListener(CONNECTIVITY_STATE_EVENT, handleState);
  notificationCleanup = () => {
    clearPendingRecoverySync();
    window.removeEventListener(CONNECTIVITY_STATE_EVENT, handleState);
  };

  return () => {
    notificationReferences = Math.max(0, notificationReferences - 1);
    if (notificationReferences === 0) {
      notificationCleanup?.();
      notificationCleanup = null;
    }
  };
};

export const useConnectivityState = () => {
  const [state, setState] = useState<ConnectivityState>(getConnectivityState());

  useEffect(() => {
    const handleState = (event: Event) => {
      const nextState = (event as CustomEvent<ConnectivityState>).detail;
      setState(nextState);
    };

    window.addEventListener(CONNECTIVITY_STATE_EVENT, handleState);
    const cleanupNotifications = initializeConnectivityNotifications();
    const cleanupMonitoring = initializeConnectivityMonitoring();
    setState(getConnectivityState());

    return () => {
      window.removeEventListener(CONNECTIVITY_STATE_EVENT, handleState);
      cleanupMonitoring();
      cleanupNotifications();
    };
  }, []);

  return state;
};

export const useNetworkStatus = () => {
  const state = useConnectivityState();
  return state === "online" || state === "degraded";
};
