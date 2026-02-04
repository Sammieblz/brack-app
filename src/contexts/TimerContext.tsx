import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { updateBookStatusIfNeeded } from "@/utils/bookStatus";
import { useConfirmDialog } from "@/contexts/ConfirmDialogContext";

interface TimerState {
  time: number;
  isRunning: boolean;
  startTime: Date | null;
  bookId: string | null;
  bookTitle: string | null;
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

export const TimerProvider = ({ children }: { children: ReactNode }) => {
  const confirmDialog = useConfirmDialog();
  const [state, setState] = useState<TimerState>({
    time: 0,
    isRunning: false,
    startTime: null,
    bookId: null,
    bookTitle: null,
    isVisible: false,
    isMinimized: true,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backgroundTimeRef = useRef<Date | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const restoredState = {
          ...parsed,
          startTime: parsed.startTime ? new Date(parsed.startTime) : null,
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
    if (!Capacitor.isNativePlatform()) {
      return; // Only needed for native apps
    }

    const handleAppStateChange = async ({ isActive }: { isActive: boolean }) => {
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
    };

    const listener = App.addListener('appStateChange', handleAppStateChange);

    return () => {
      listener.remove();
    };
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
    const updateTimerNotification = async () => {
      if (!Capacitor.isNativePlatform()) return;

      if (state.isRunning && state.isVisible && state.bookTitle) {
        const hours = Math.floor(state.time / 3600);
        const minutes = Math.floor((state.time % 3600) / 60);
        const seconds = state.time % 60;
        
        const timeString = hours > 0 
          ? `${hours}h ${minutes}m`
          : minutes > 0
          ? `${minutes}m ${seconds}s`
          : `${seconds}s`;

        try {
          await LocalNotifications.schedule({
            notifications: [
              {
                title: `Reading: ${state.bookTitle}`,
                body: `Timer running: ${timeString}`,
                id: 1,
                schedule: { at: new Date(Date.now() + 1000) },
                ongoing: true,
                sound: undefined,
                attachments: undefined,
                actionTypeId: 'TIMER_ACTION',
                extra: {
                  bookId: state.bookId,
                  action: 'stop',
                },
              },
            ],
          });

          // Update notification every minute
          if (notificationIntervalRef.current) {
            clearInterval(notificationIntervalRef.current);
          }
          
          notificationIntervalRef.current = setInterval(async () => {
            if (state.isRunning && state.isVisible) {
              const hours = Math.floor(state.time / 3600);
              const minutes = Math.floor((state.time % 3600) / 60);
              const timeString = hours > 0 
                ? `${hours}h ${minutes}m`
                : `${minutes}m`;
              
              try {
                await LocalNotifications.schedule({
                  notifications: [
                    {
                      title: `Reading: ${state.bookTitle}`,
                      body: `Timer running: ${timeString}`,
                      id: 1,
                      schedule: { at: new Date(Date.now() + 1000) },
                      ongoing: true,
                      sound: undefined,
                      attachments: undefined,
                      actionTypeId: 'TIMER_ACTION',
                      extra: {
                        bookId: state.bookId,
                        action: 'stop',
                      },
                    },
                  ],
                });
              } catch (error) {
                console.error('Error updating timer notification:', error);
              }
            }
          }, 60000); // Update every minute
        } catch (error) {
          console.error('Error showing timer notification:', error);
        }
      } else {
        // Clear notification when timer stops
        if (notificationIntervalRef.current) {
          clearInterval(notificationIntervalRef.current);
          notificationIntervalRef.current = null;
        }
        try {
          await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
        } catch (error) {
          console.error('Error clearing timer notification:', error);
        }
      }
    };

    updateTimerNotification();

    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
      }
    };
  }, [state.isRunning, state.isVisible, state.time, state.bookTitle, state.bookId]);

  // Request notification permissions on mount
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.requestPermissions().catch(console.error);
    }
  }, []);

  // Handle notification actions (stop timer from notification)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: any = null;

    const setupListener = async () => {
      listener = await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        (notification) => {
          if (notification.notification.extra?.action === 'stop' && state.isRunning) {
            // Cancel the timer
            setState({
              time: 0,
              isRunning: false,
              startTime: null,
              bookId: null,
              bookTitle: null,
              isVisible: false,
              isMinimized: true,
            });
            toast.info("Timer stopped from notification");
          }
        }
      );
    };

    setupListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to save sessions");
        return;
      }

      const endTime = new Date();
      const durationMinutes = Math.round(state.time / 60);

      const { error } = await supabase
        .from('reading_sessions')
        .insert({
          user_id: user.id,
          book_id: state.bookId,
          start_time: state.startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration: durationMinutes
        });

      if (error) throw error;

      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      toast.success(`Reading session saved: ${hours}h ${minutes}m`);

      // Update book status if needed
      await updateBookStatusIfNeeded(state.bookId);

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
    } catch (error: any) {
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
