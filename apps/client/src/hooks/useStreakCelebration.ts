import { useCallback, useEffect, useRef, useState } from "react";

export interface UseStreakCelebrationOptions {
  /** The authenticated reader. Changing readers establishes a fresh baseline. */
  userId: string | null | undefined;
  /** True only after the streak state has been authoritatively hydrated. */
  ready: boolean;
  /** Whether the authoritative streak state says today's reading is complete. */
  completedToday: boolean;
  currentStreak: number;
  /** A stable server-derived identity, normally the last-reading date key. */
  completionKey?: string | null;
}

export interface StreakCelebrationState {
  isOpen: boolean;
  streak: number;
  celebrationKey: string | null;
  dismiss: () => void;
}

interface ObservedStreak {
  userId: string;
  initialized: boolean;
  completedToday: boolean;
  lastCelebratedKey: string | null;
}

const normalizeStreak = (streak: number) => (
  Number.isFinite(streak) ? Math.max(1, Math.trunc(streak)) : 1
);

const getCompletionIdentity = (
  userId: string,
  currentStreak: number,
  completionKey?: string | null,
) => completionKey || `${userId}:streak:${normalizeStreak(currentStreak)}`;

/**
 * Opens a streak celebration only for a live, confirmed incomplete-to-complete
 * transition. The first ready snapshot is deliberately treated as a baseline,
 * so revisiting the app with an already-completed streak never replays history.
 */
export const useStreakCelebration = ({
  userId,
  ready,
  completedToday,
  currentStreak,
  completionKey,
}: UseStreakCelebrationOptions): StreakCelebrationState => {
  const observedRef = useRef<ObservedStreak | null>(null);
  const [celebration, setCelebration] = useState<{
    streak: number;
    key: string;
  } | null>(null);

  useEffect(() => {
    if (!userId) {
      observedRef.current = null;
      setCelebration(null);
      return;
    }

    let observed = observedRef.current;
    if (!observed || observed.userId !== userId) {
      observed = {
        userId,
        initialized: false,
        completedToday: false,
        lastCelebratedKey: null,
      };
      observedRef.current = observed;
      setCelebration(null);
    }

    // Provisional/cached state is not a continuation of a confirmed observer
    // session. Disarm until the next authoritative snapshot can form a fresh
    // baseline, and close any reveal whose confirmation is no longer present.
    if (!ready) {
      observed.initialized = false;
      observed.completedToday = false;
      observed.lastCelebratedKey = null;
      setCelebration(null);
      return;
    }

    const identity = getCompletionIdentity(userId, currentStreak, completionKey);
    if (!observed.initialized) {
      observed.initialized = true;
      observed.completedToday = completedToday;
      observed.lastCelebratedKey = completedToday ? identity : null;
      return;
    }

    const wasCompletedToday = observed.completedToday;
    observed.completedToday = completedToday;

    if (
      !wasCompletedToday
      && completedToday
      && observed.lastCelebratedKey !== identity
    ) {
      observed.lastCelebratedKey = identity;
      setCelebration({
        streak: normalizeStreak(currentStreak),
        key: identity,
      });
    }
  }, [completedToday, completionKey, currentStreak, ready, userId]);

  const dismiss = useCallback(() => setCelebration(null), []);

  return {
    isOpen: Boolean(celebration),
    streak: celebration?.streak ?? normalizeStreak(currentStreak),
    celebrationKey: celebration?.key ?? null,
    dismiss,
  };
};
