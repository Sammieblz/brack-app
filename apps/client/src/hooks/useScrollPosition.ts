import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const scrollPositions = new Map<string, number>();

export const useScrollPosition = (key?: string) => {
  const location = useLocation();
  const containerRef = useRef<HTMLElement | null>(null);
  
  // Use provided key or default to pathname
  const storageKey = key || location.pathname;

  useEffect(() => {
    const container = containerRef.current || window;
    const savedPosition = scrollPositions.get(storageKey) || 0;

    // Restore scroll position
    const restoreScroll = () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = savedPosition;
      } else {
        window.scrollTo(0, savedPosition);
      }
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(restoreScroll, 0);

    // Save scroll position on unmount
    return () => {
      clearTimeout(timeoutId);
      
      const currentPosition = containerRef.current
        ? containerRef.current.scrollTop
        : window.scrollY || document.documentElement.scrollTop;
      
      scrollPositions.set(storageKey, currentPosition);
    };
  }, [storageKey]);

  useEffect(() => {
    const container = containerRef.current || window;
    
    const handleScroll = () => {
      const scrollTop = containerRef.current
        ? containerRef.current.scrollTop
        : window.scrollY || document.documentElement.scrollTop;
      
      scrollPositions.set(storageKey, scrollTop);
    };

    if (containerRef.current) {
      containerRef.current.addEventListener("scroll", handleScroll, { passive: true });
    } else {
      window.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener("scroll", handleScroll);
      } else {
        window.removeEventListener("scroll", handleScroll);
      }
    };
  }, [storageKey]);

  return containerRef;
};

// Hook for persisting scroll position in sessionStorage (survives page refresh)
export const usePersistentScrollPosition = (key?: string) => {
  const location = useLocation();
  const containerRef = useRef<HTMLElement | null>(null);
  const storageKey = `scroll_${key || location.pathname}`;

  useEffect(() => {
    const container = containerRef.current || window;
    
    // Restore from sessionStorage
    const savedPosition = sessionStorage.getItem(storageKey);
    if (savedPosition) {
      const position = parseInt(savedPosition, 10);
      const restoreScroll = () => {
        if (containerRef.current) {
          containerRef.current.scrollTop = position;
        } else {
          window.scrollTo(0, position);
        }
      };
      setTimeout(restoreScroll, 0);
    }

    // Save scroll position
    const handleScroll = () => {
      const scrollTop = containerRef.current
        ? containerRef.current.scrollTop
        : window.scrollY || document.documentElement.scrollTop;
      
      sessionStorage.setItem(storageKey, scrollTop.toString());
    };

    if (containerRef.current) {
      containerRef.current.addEventListener("scroll", handleScroll, { passive: true });
    } else {
      window.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener("scroll", handleScroll);
      } else {
        window.removeEventListener("scroll", handleScroll);
      }
    };
  }, [storageKey]);

  return containerRef;
};
