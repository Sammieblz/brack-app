import { useEffect, useState } from "react";
import { toast } from "sonner";
import { readingCoreSync } from "@/services/sync/engine";
import {
  CONNECTIVITY_STATE_EVENT,
  getConnectivityState,
  initializeConnectivityMonitoring,
  probeConnectivity,
} from "@/services/connectivity";
import type { ConnectivityState } from "@/types";

export const useConnectivityState = () => {
  const [state, setState] = useState<ConnectivityState>(getConnectivityState());

  useEffect(() => {
    const cleanup = initializeConnectivityMonitoring();
    const handleState = (event: Event) => {
      const nextState = (event as CustomEvent<ConnectivityState>).detail;
      setState((previous) => {
        if (previous !== "online" && nextState === "online") {
          toast.success("Back online");
          window.setTimeout(() => readingCoreSync.syncCurrentUser().catch(console.error), 500);
        } else if (previous !== "offline" && nextState === "offline") {
          toast.info("You're offline. Reading changes will save locally and sync later.");
        } else if (previous === "online" && nextState === "degraded") {
          toast.info("Connection is limited. Reading changes are being saved locally.");
        }
        return nextState;
      });
    };

    window.addEventListener(CONNECTIVITY_STATE_EVENT, handleState);
    void probeConnectivity();

    return () => {
      cleanup();
      window.removeEventListener(CONNECTIVITY_STATE_EVENT, handleState);
    };
  }, []);

  return state;
};

export const useNetworkStatus = () => {
  const state = useConnectivityState();
  return state === "online" || state === "degraded";
};
