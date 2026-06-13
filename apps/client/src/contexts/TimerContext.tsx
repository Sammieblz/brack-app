import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";
import { createReadingSession, getCurrentAuthUser } from "@/services/api";
import { booksRepo, sessionsRepo } from "@/services/local";
import { timerNativeService } from "@/services/timerNative";

interface TimerState {
  time: number;
  isRunning: boolean;
  startTime: Date | null;
  bookId: string | null;
  bookTitle: string | null;
  clientSessionId: string | null;
  isVisible: boolean;
  isMinimized: boolean;
}

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

const STORAGE_KEY = 'readingTimer';

const createClientSessionId = (bookId: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${bookId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const TimerProvider = ({ children }: { children: ReactNode }) => {
  const confirmDialog = useConfirmDialog();
  const queryClient = useQueryClient();
  const [state, setState] = useState<TimerState>({
    time: 0,
    isRunning: false,
    startTime: null,
    bookId: null,
    bookTitle: null,
    clientSessionId: null,
    isVisible: false,
    isMinimized: true,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const backgroundTimeRef = useRef<Date | null>(null);
  const notificationMinute = Math.floor(state.time / 60);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const restoredState = {
          ...parsed,
          startTime: parsed.startTime ? new Date(parsed.startTime) : null,
          clientSessionId: parsed.clientSessionId || null,
        };
        
        // If timer was running, calculate elapsed time while app was backgrounded
        if (restoredState.isRunning && restoredState.startTime) {
          const now = new Date();
          const elapsed = Math.floor((now.getTime() - restoredState.startTime.getTime()) / 1000);
          restoredState.time = elapsed;
        }
        
        setState(restoredState);
      } catch (error) {
        console.error('Error loading timer state:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    return timerNativeService.onAppStateChange(({ isActive }) => {
      if (!isActive) {
        // App going to background - save current state
        backgroundTimeRef.current = new Date();
        if (state.isRunning && state.startTime) {
          // Calculate elapsed time up to now
          const elapsed = Math.floor((backgroundTimeRef.current.getTime() - state.startTime.getTime()) / 1000);
          setState(prev => ({ ...prev, time: elapsed, isRunning: false }));
        }
      } else {
        // App coming to foreground - restore timer if it was running
        if (state.isVisible && state.startTime && !state.isRunning) {
          const now = new Date();
          const elapsed = Math.floor((now.getTime() - state.startTime.getTime()) / 1000);
          setState(prev => ({ ...prev, time: elapsed, isRunning: true }));
        }
      }
    });
  }, [state.isRunning, state.isVisible, state.startTime]);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (state.isVisible) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [state]);

  // Timer interval
  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(() => {
        setState(prev => ({ ...prev, time: prev.time + 1 }));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.isRunning]);

  // Background notification for timer
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

  // Request notification permissions on mount
  useEffect(() => {
    timerNativeService.requestNotificationPermissions().catch(console.error);
  }, []);

  // Handle notification actions (stop timer from notification)
  useEffect(() => {
    return timerNativeService.onTimerAction((action) => {
      if (action === "stop" && state.isRunning) {
        // Cancel the timer
        setState({
          time: 0,
          isRunning: false,
          startTime: null,
          bookId: null,
          bookTitle: null,
          clientSessionId: null,
          isVisible: false,
          isMinimized: true,
        });
        toast.info("Timer stopped from notification");
      }
    });
  }, [state.isRunning]);

  const startTimer = (bookId: string, bookTitle: string) => {
    const handleStart = async () => {
      if (state.isVisible && state.bookId) {
        const confirmed = await confirmDialog({
          title: "Replace running timer?",
          description: "A timer is already running. Cancel it and start a new one?",
          confirmText: "Start new",
          cancelText: "Keep current",
        });
        if (!confirmed) return;
      }

      setState({
        time: 0,
        isRunning: true,
        startTime: new Date(),
        bookId,
        bookTitle,
        clientSessionId: createClientSessionId(bookId),
        isVisible: true,
        isMinimized: true,
      });
      toast.success(`Timer started for "${bookTitle}"`);
    };

    void handleStart();
  };

  const pauseTimer = () => {
    setState(prev => ({ ...prev, isRunning: false }));
  };

  const resumeTimer = () => {
    setState(prev => ({ ...prev, isRunning: true }));
  };

  const finishTimer = async (showJournalPrompt: boolean = true) => {
    if (state.time === 0) {
      toast.error("No time recorded");
      return;
    }

    if (!state.bookId || !state.startTime) {
      toast.error("Missing required data to save session");
      return;
    }

    try {
      const endTime = new Date();
      const durationMinutes = Math.max(1, Math.round(state.time / 60));
      const clientSessionId = state.clientSessionId || createClientSessionId(state.bookId);

      if (!navigator.onLine) {
        const user = await getCurrentAuthUser();
        if (!user) throw new Error("Not authenticated");

        const session = {
          id: clientSessionId,
          user_id: user.id,
          book_id: state.bookId,
          start_time: state.startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration: durationMinutes,
          client_session_id: clientSessionId,
          created_at: endTime.toISOString(),
        };

        await sessionsRepo.createPending(user.id, session);

        const localBook = await booksRepo.get(state.bookId);
        if (localBook) {
          await booksRepo.upsertLocal(user.id, {
            ...localBook,
            status: localBook.status === "to_read" ? "reading" : localBook.status,
            date_started: localBook.date_started || state.startTime.toISOString().split("T")[0],
            updated_at: endTime.toISOString(),
          }, "update");
        }

        toast.success("Reading session saved offline");

        window.dispatchEvent(new CustomEvent('readingSessionSaved', {
          detail: {
            userId: user.id,
            bookId: state.bookId,
            sessionId: session.id,
            durationMinutes,
            activityDate: state.startTime.toISOString().split('T')[0],
            pendingSync: true,
          },
        }));

        const sessionData = {
          bookId: state.bookId,
          bookTitle: state.bookTitle,
          durationMinutes,
        };

        setState({
          time: 0,
          isRunning: false,
          startTime: null,
          bookId: null,
          bookTitle: null,
          clientSessionId: null,
          isVisible: false,
          isMinimized: true,
        });

        if (showJournalPrompt && durationMinutes >= 5) {
          window.dispatchEvent(new CustomEvent('showJournalPrompt', {
            detail: sessionData
          }));
        }
        return;
      }

      const result = await createReadingSession({
        bookId: state.bookId,
        startTime: state.startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes,
        clientSessionId,
      });

      const session = result.session;
      if (!session) {
        throw new Error("Reading session was not returned");
      }

      const userId = session.user_id;

      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      toast.success(`Reading session saved: ${hours}h ${minutes}m`);

      if (userId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
          queryClient.invalidateQueries({ queryKey: ["books", userId] }),
        ]);
      }

      window.dispatchEvent(new CustomEvent('readingSessionSaved', {
        detail: {
          userId,
          bookId: state.bookId,
          sessionId: session?.id,
          durationMinutes,
          activityDate: state.startTime.toISOString().split('T')[0],
        },
      }));

      if (userId && result.awarded_badges && result.awarded_badges.length > 0) {
        window.dispatchEvent(new CustomEvent('badgesAwarded', {
          detail: {
            userId,
            badges: result.awarded_badges,
          },
        }));
      }

      // Store session data temporarily for journal prompt
      const sessionData = {
        bookId: state.bookId,
        bookTitle: state.bookTitle,
        durationMinutes,
      };

      // Reset state
      setState({
        time: 0,
        isRunning: false,
        startTime: null,
        bookId: null,
        bookTitle: null,
        clientSessionId: null,
        isVisible: false,
        isMinimized: true,
      });

      // Trigger journal prompt event if enabled
      if (showJournalPrompt && durationMinutes >= 5) {
        // Only prompt for sessions longer than 5 minutes
        window.dispatchEvent(new CustomEvent('showJournalPrompt', {
          detail: sessionData
        }));
      }
    } catch (error: unknown) {
      console.error('Error saving session:', error);
      toast.error("Failed to save reading session");
    }
  };

  const cancelTimer = () => {
    const handleCancel = async () => {
      if (state.isRunning || state.time > 0) {
        const confirmed = await confirmDialog({
          title: "Cancel this session?",
          description: "All progress for this timer will be lost.",
          confirmText: "Cancel session",
          cancelText: "Keep timer",
        });
        if (!confirmed) return;
      }

      setState({
        time: 0,
        isRunning: false,
        startTime: null,
        bookId: null,
        bookTitle: null,
        clientSessionId: null,
        isVisible: false,
        isMinimized: true,
      });
      toast.info("Timer cancelled");
    };

    void handleCancel();
  };

  const toggleMinimized = () => {
    setState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  };

  const hideWidget = () => {
    setState(prev => ({ ...prev, isVisible: false }));
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
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within TimerProvider');
  }
  return context;
};
