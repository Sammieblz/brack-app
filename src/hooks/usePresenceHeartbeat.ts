import { useCallback, useEffect, useRef } from "react";
import { updatePresence } from "@/services/api";
import { useAuth } from "./useAuth";

const HEARTBEAT_INTERVAL_MS = 60_000;

export const usePresenceHeartbeat = () => {
  const { user } = useAuth();
  const lastSentAtRef = useRef(0);

  const sendPresence = useCallback(
    async (force = false) => {
      if (!user || !navigator.onLine || document.visibilityState === "hidden") {
        return;
      }

      const now = Date.now();
      if (!force && now - lastSentAtRef.current < HEARTBEAT_INTERVAL_MS) {
        return;
      }

      lastSentAtRef.current = now;
      try {
        await updatePresence();
      } catch (error) {
        console.warn("Presence heartbeat failed", error);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user) return;

    sendPresence(true);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendPresence(true);
      }
    };
    const onFocus = () => sendPresence();
    const onOnline = () => sendPresence(true);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    const interval = window.setInterval(() => {
      sendPresence();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
    };
  }, [sendPresence, user]);
};
