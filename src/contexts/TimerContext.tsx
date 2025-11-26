import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
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
  finishTimer: () => Promise<void>;
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

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState({
          ...parsed,
          startTime: parsed.startTime ? new Date(parsed.startTime) : null,
        });
      } catch (error) {
        console.error('Error loading timer state:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

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

  const finishTimer = async () => {
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
