import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MobileDialog } from "@/components/ui/mobile-dialog";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
import { emitBooksChanged, getCurrentAuthUser } from "@/services/api";
import { booksRepo, sessionsRepo } from "@/services/local";
import { timerNativeService } from "@/services/timerNative";
import { readingCoreSync } from "@/services/sync/engine";
import { isConnectivityAvailable } from "@/services/connectivity";
import {
  MAX_READING_SESSION_MINUTES,
  MAX_READING_SESSION_SECONDS,
  TIMER_PERSIST_INTERVAL_MS,
  TIMER_RECOVERY_STORAGE_KEY,
  TIMER_STORAGE_KEY,
  clampSessionMinutes,
  createStaleTimerSnapshot,
  emptyTimerState,
  getSessionEndFromDuration,
  isTimerBeyondSessionLimit,
  normalizePersistedTimerRecovery,
  normalizePersistedTimerState,
  refreshTimerState,
  type NormalizedTimerState,
  type StaleTimerSnapshot,
} from "@/services/timerSession";

type TimerState = NormalizedTimerState;

interface TimerContextType extends TimerState {
  startTimer: (bookId: string, bookTitle: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  finishTimer: (showJournalPrompt?: boolean) => Promise<void>;
  cancelTimer: () => void;
  toggleMinimized: () => void;
  hideWidget: () => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

const createClientSessionId = (bookId: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${bookId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const formatDurationSummary = (durationMinutes: number) => {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
};

export const TimerProvider = ({ children }: { children: ReactNode }) => {
  const confirmDialog = useConfirmDialog();
  const [state, setState] = useState<TimerState>(() => emptyTimerState());
  const [recovery, setRecovery] = useState<StaleTimerSnapshot | null>(null);
  const [recoveryMinutes, setRecoveryMinutes] = useState("30");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<TimerState>(state);
  const lastPersistedAtRef = useRef(0);
  const persistedRunningRef = useRef<boolean | null>(null);
  const persistedSessionIdRef = useRef<string | null>(null);

  const notificationMinute = Math.floor(state.time / 60);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const persistTimerState = useCallback((nextState: TimerState) => {
    if (typeof localStorage === "undefined") return;

    if (!nextState.isVisible) {
      localStorage.removeItem(TIMER_STORAGE_KEY);
      lastPersistedAtRef.current = 0;
      persistedRunningRef.current = null;
      persistedSessionIdRef.current = null;
      return;
    }

    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(nextState));
    lastPersistedAtRef.current = Date.now();
    persistedRunningRef.current = nextState.isRunning;
    persistedSessionIdRef.current = nextState.clientSessionId;
  }, []);

  const persistRecovery = useCallback((snapshot: StaleTimerSnapshot | null) => {
    if (typeof localStorage === "undefined") return;
    if (!snapshot) {
      localStorage.removeItem(TIMER_RECOVERY_STORAGE_KEY);
      return;
    }

    localStorage.setItem(TIMER_RECOVERY_STORAGE_KEY, JSON.stringify(snapshot));
  }, []);

  const clearTimerState = useCallback(() => {
    const empty = emptyTimerState();
    setState(empty);
    persistTimerState(empty);
  }, [persistTimerState]);

  const clearRecoveryState = useCallback(() => {
    setRecovery(null);
    persistRecovery(null);
  }, [persistRecovery]);

  const openRecovery = useCallback(
    (snapshot: StaleTimerSnapshot) => {
      setRecovery(snapshot);
      setRecoveryMinutes(String(snapshot.suggestedMinutes));
      persistRecovery(snapshot);
      clearTimerState();
      toast.warning("Reading timer paused for review", {
        description: "That session ran longer than Brack can safely save automatically.",
      });
    },
    [clearTimerState, persistRecovery],
  );

  const saveReadingSession = useCallback(
    async ({
      bookId,
      bookTitle,
      startTime,
      endTime,
      durationMinutes,
      clientSessionId,
      showJournalPrompt,
    }: {
      bookId: string;
      bookTitle: string | null;
      startTime: Date;
      endTime: Date;
      durationMinutes: number;
      clientSessionId: string;
      showJournalPrompt: boolean;
    }) => {
      const user = await getCurrentAuthUser();
      if (!user) throw new Error("Not authenticated");

      // A persisted timer can outlive a local book identity remap. Resolve its
      // saved ID before writing anything so every follow-up record and event
      // consistently targets the canonical book.
      const resolvedBookId = await booksRepo.resolveIdentity(user.id, bookId);

      const session = {
        id: clientSessionId,
        user_id: user.id,
        book_id: resolvedBookId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration: durationMinutes,
        client_session_id: clientSessionId,
        created_at: new Date().toISOString(),
      };

      await sessionsRepo.createPending(user.id, session);

      const localBook = await booksRepo.get(resolvedBookId);
      if (localBook) {
        const updatedBook = {
          ...localBook,
          status: localBook.status === "to_read" ? "reading" : localBook.status,
          date_started: localBook.date_started || startTime.toISOString().split("T")[0],
          updated_at: new Date().toISOString(),
        };
        await booksRepo.upsertLocal(user.id, updatedBook, "update");
        emitBooksChanged({ type: "upsert", userId: user.id, book: updatedBook });
      }

      if (isConnectivityAvailable()) {
        void readingCoreSync.syncUser(user.id).catch(console.error);
      }

      toast.success(
        isConnectivityAvailable()
          ? `Reading session saved: ${formatDurationSummary(durationMinutes)}`
          : "Reading session saved offline",
      );

      window.dispatchEvent(
        new CustomEvent("readingSessionSaved", {
          detail: {
            userId: user.id,
            bookId: resolvedBookId,
            sessionId: session.id,
            durationMinutes,
            activityDate: startTime.toISOString().split("T")[0],
            pendingSync: true,
          },
        }),
      );

      if (showJournalPrompt && durationMinutes >= 5) {
        window.dispatchEvent(
          new CustomEvent("showJournalPrompt", {
            detail: {
              bookId: resolvedBookId,
              bookTitle,
              durationMinutes,
            },
          }),
        );
      }
    },
    [],
  );

  useEffect(() => {
    const storedRecovery = localStorage.getItem(TIMER_RECOVERY_STORAGE_KEY);
    if (storedRecovery) {
      try {
        const recoverySnapshot = normalizePersistedTimerRecovery(JSON.parse(storedRecovery));
        if (recoverySnapshot) {
          openRecovery(recoverySnapshot);
          return;
        }
      } catch (error) {
        console.error("Error loading timer recovery state:", error);
      }
      localStorage.removeItem(TIMER_RECOVERY_STORAGE_KEY);
    }

    const stored = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!stored) return;

    try {
      const restore = normalizePersistedTimerState(JSON.parse(stored), new Date());
      if (restore.kind === "active") {
        setState(restore.state);
        persistTimerState(restore.state);
      } else if (restore.kind === "stale") {
        openRecovery(restore.recovery);
      } else {
        localStorage.removeItem(TIMER_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error loading timer state:", error);
      localStorage.removeItem(TIMER_STORAGE_KEY);
    }
  }, [openRecovery, persistTimerState]);

  useEffect(() => {
    return timerNativeService.onAppStateChange(() => {
      setState((previous) => (previous.isVisible ? refreshTimerState(previous) : previous));
    });
  }, []);

  useEffect(() => {
    const now = Date.now();
    const modeChanged = persistedRunningRef.current !== state.isRunning;
    const sessionChanged = persistedSessionIdRef.current !== state.clientSessionId;
    const due = now - lastPersistedAtRef.current >= TIMER_PERSIST_INTERVAL_MS;

    if (!state.isVisible || !state.isRunning || modeChanged || sessionChanged || due) {
      persistTimerState(state);
    }
  }, [persistTimerState, state]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      persistTimerState(stateRef.current);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        setState((previous) => {
          const refreshed = previous.isVisible ? refreshTimerState(previous) : previous;
          persistTimerState(refreshed);
          return refreshed;
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [persistTimerState]);

  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(() => {
        setState((previous) => (previous.isVisible ? refreshTimerState(previous) : previous));
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isRunning]);

  useEffect(() => {
    if (!state.isVisible || recovery || !isTimerBeyondSessionLimit(state.time)) return;
    const snapshot = createStaleTimerSnapshot(state);
    if (snapshot) {
      openRecovery(snapshot);
    } else {
      clearTimerState();
      toast.error("Timer stopped because its saved state was invalid.");
    }
  }, [clearTimerState, openRecovery, recovery, state]);

  useEffect(() => {
    timerNativeService
      .syncTimerNotification({
        isRunning: state.isRunning,
        isVisible: state.isVisible,
        elapsedSeconds: notificationMinute * 60,
        bookId: state.bookId,
        bookTitle: state.bookTitle,
      })
      .catch((error) => {
        console.error("Error syncing timer notification:", error);
      });
  }, [state.isRunning, state.isVisible, notificationMinute, state.bookTitle, state.bookId]);

  const startTimer = (bookId: string, bookTitle: string) => {
    const handleStart = async () => {
      if (stateRef.current.isVisible && stateRef.current.bookId) {
        const confirmed = await confirmDialog({
          title: "Replace running timer?",
          description: "A timer is already running. Cancel it and start a new one?",
          confirmText: "Start new",
          cancelText: "Keep current",
        });
        if (!confirmed) return;
      }

      // A timer start is a deliberate feature action. Readers who skipped the
      // post-signup notification step are prompted here, never at app launch.
      await timerNativeService.requestNotificationPermissions().catch((error) => {
        console.error("Unable to request timer notification permission:", error);
      });

      const now = new Date();
      const nextState: TimerState = {
        time: 0,
        accumulatedSeconds: 0,
        isRunning: true,
        startTime: now,
        runningSince: now,
        bookId,
        bookTitle,
        clientSessionId: createClientSessionId(bookId),
        isVisible: true,
        isMinimized: true,
      };
      clearRecoveryState();
      setState(nextState);
      persistTimerState(nextState);
      toast.success(`Timer started for "${bookTitle}"`);
    };

    void handleStart();
  };

  const pauseTimer = () => {
    setState((previous) => {
      const refreshed = refreshTimerState(previous);
      return {
        ...refreshed,
        isRunning: false,
        runningSince: null,
        accumulatedSeconds: refreshed.time,
      };
    });
  };

  const resumeTimer = () => {
    setState((previous) => {
      if (!previous.isVisible || !previous.bookId) return previous;
      const refreshed = refreshTimerState(previous);
      if (isTimerBeyondSessionLimit(refreshed.time)) return refreshed;
      return {
        ...refreshed,
        isRunning: true,
        runningSince: new Date(),
        accumulatedSeconds: refreshed.time,
      };
    });
  };

  const finishTimer = useCallback(
    async (showJournalPrompt: boolean = true) => {
      const current = refreshTimerState(stateRef.current);
      if (current.time === 0) {
        toast.error("No time recorded");
        return;
      }

      if (!current.bookId || !current.startTime) {
        toast.error("Missing required data to save session");
        return;
      }

      if (isTimerBeyondSessionLimit(current.time)) {
        const snapshot = createStaleTimerSnapshot(current);
        if (snapshot) openRecovery(snapshot);
        return;
      }

      try {
        const endTime = new Date();
        const durationMinutes = clampSessionMinutes(current.time / 60);
        const clientSessionId = current.clientSessionId || createClientSessionId(current.bookId);

        await saveReadingSession({
          bookId: current.bookId,
          bookTitle: current.bookTitle,
          startTime: current.startTime,
          endTime,
          durationMinutes,
          clientSessionId,
          showJournalPrompt,
        });

        clearTimerState();
      } catch (error: unknown) {
        console.error("Error saving session:", error);
        toast.error("Failed to save reading session");
      }
    },
    [clearTimerState, openRecovery, saveReadingSession],
  );

  useEffect(() => {
    return timerNativeService.onTimerAction((action) => {
      if (action === "stop") {
        void finishTimer(false);
      }
    });
  }, [finishTimer]);

  const cancelTimer = () => {
    const handleCancel = async () => {
      const current = refreshTimerState(stateRef.current);
      if (current.isRunning || current.time > 0) {
        const confirmed = await confirmDialog({
          title: "Cancel this session?",
          description: "All progress for this timer will be lost.",
          confirmText: "Cancel session",
          cancelText: "Keep timer",
        });
        if (!confirmed) return;
      }

      clearTimerState();
      toast.info("Timer cancelled");
    };

    void handleCancel();
  };

  const toggleMinimized = () => {
    setState((previous) => ({ ...previous, isMinimized: !previous.isMinimized }));
  };

  const hideWidget = () => {
    setState((previous) => {
      const refreshed = refreshTimerState(previous);
      return {
        ...refreshed,
        isRunning: false,
        runningSince: null,
        accumulatedSeconds: refreshed.time,
        isVisible: false,
      };
    });
  };

  const handleSaveRecovery = async () => {
    if (!recovery) return;
    const durationMinutes = clampSessionMinutes(Number(recoveryMinutes));
    try {
      await saveReadingSession({
        bookId: recovery.bookId,
        bookTitle: recovery.bookTitle,
        startTime: recovery.startTime,
        endTime: getSessionEndFromDuration(recovery.startTime, durationMinutes),
        durationMinutes,
        clientSessionId: recovery.clientSessionId || createClientSessionId(recovery.bookId),
        showJournalPrompt: durationMinutes >= 5,
      });
      clearRecoveryState();
    } catch (error) {
      console.error("Error saving recovered timer:", error);
      toast.error("Failed to save recovered timer");
    }
  };

  const handleDiscardRecovery = () => {
    clearRecoveryState();
    clearTimerState();
    toast.info("Stale timer discarded");
  };

  return (
    <TimerContext.Provider
      value={{
        ...state,
        startTimer,
        pauseTimer,
        resumeTimer,
        finishTimer,
        cancelTimer,
        toggleMinimized,
        hideWidget,
      }}
    >
      {children}
      <MobileDialog
        open={Boolean(recovery)}
        onOpenChange={() => undefined}
        title="Review old timer"
        description={`This timer ran past Brack's ${MAX_READING_SESSION_MINUTES / 60}-hour safety limit. Save the time you actually read, or discard it.`}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={handleDiscardRecovery}>
              Discard timer
            </Button>
            <Button type="button" onClick={handleSaveRecovery}>
              Save reviewed time
            </Button>
          </div>
        }
      >
        {recovery && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <p className="font-sans text-sm font-medium text-foreground">
                {recovery.bookTitle || "Reading timer"}
              </p>
              <p className="mt-1 font-sans text-xs text-muted-foreground">
                Recorded elapsed time was about{" "}
                {Math.round(recovery.elapsedSeconds / 3600).toLocaleString()} hours.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timer-recovery-minutes">Minutes actually read</Label>
              <Input
                id="timer-recovery-minutes"
                type="number"
                min={1}
                max={MAX_READING_SESSION_MINUTES}
                value={recoveryMinutes}
                onChange={(event) => setRecoveryMinutes(event.target.value)}
              />
              <p className="font-sans text-xs text-muted-foreground">
                Maximum per timer session: {MAX_READING_SESSION_SECONDS / 3600} hours.
              </p>
            </div>
          </div>
        )}
      </MobileDialog>
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within TimerProvider");
  }
  return context;
};
