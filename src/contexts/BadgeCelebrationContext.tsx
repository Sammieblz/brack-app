import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import type { Badge } from "@/types";
import { BadgeCelebrationOverlay } from "@/components/BadgeCelebrationOverlay";

interface BadgeCelebrationContextValue {
  showCelebration: (badge: Badge) => void;
  hideCelebration: () => void;
}

const BadgeCelebrationContext = createContext<BadgeCelebrationContextValue | undefined>(undefined);

interface BadgeCelebrationProviderProps {
  children: ReactNode;
}

export const BadgeCelebrationProvider = ({ children }: BadgeCelebrationProviderProps) => {
  const [currentBadge, setCurrentBadge] = useState<Badge | null>(null);
  const [queue, setQueue] = useState<Badge[]>([]);
  const [open, setOpen] = useState(false);

  const showCelebration = useCallback((badge: Badge) => {
    // If nothing is showing, display immediately. Otherwise queue it.
    setQueue((prev) => {
      if (!open && !currentBadge) {
        setCurrentBadge(badge);
        setOpen(true);
        return prev;
      }
      return [...prev, badge];
    });
  }, [currentBadge, open]);

  const hideCelebration = useCallback(() => {
    setOpen(false);
    setCurrentBadge(null);
    setQueue((prev) => {
      if (prev.length > 0) {
        const [next, ...rest] = prev;
        setCurrentBadge(next);
        setOpen(true);
        return rest;
      }
      return prev;
    });
  }, []);

  return (
    <BadgeCelebrationContext.Provider value={{ showCelebration, hideCelebration }}>
      {children}
      {currentBadge && (
        <BadgeCelebrationOverlay
          badge={currentBadge}
          open={open}
          onClose={hideCelebration}
        />
      )}
    </BadgeCelebrationContext.Provider>
  );
};

export const useBadgeCelebration = (): BadgeCelebrationContextValue => {
  const ctx = useContext(BadgeCelebrationContext);
  if (!ctx) {
    throw new Error("useBadgeCelebration must be used within a BadgeCelebrationProvider");
  }
  return ctx;
};

