import { type RefObject, useEffect, useState } from "react";
import { NavArrowUp } from "iconoir-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addScrollListener, getScrollTop, type ScrollTarget } from "@/utils/scroll";

interface ScrollToTopProps {
  containerRef?: RefObject<HTMLElement | null>;
  threshold?: number;
  hasBottomNav?: boolean;
  resetKey?: string;
  className?: string;
}

const getTarget = (containerRef?: RefObject<HTMLElement | null>): ScrollTarget => {
  return containerRef?.current ?? window;
};

const getScrollBehavior = (): ScrollBehavior => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "auto";
  }

  return "smooth";
};

export const ScrollToTop = ({ 
  containerRef, 
  threshold = 320,
  hasBottomNav = false,
  resetKey,
  className 
}: ScrollToTopProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const target = getTarget(containerRef);

    const updateVisibility = () => {
      setIsVisible(getScrollTop(target) > threshold);
    };

    updateVisibility();
    const syncAfterRestore = window.setTimeout(updateVisibility, 120);
    const removeScrollListener = addScrollListener(target, updateVisibility, { passive: true });

    return () => {
      window.clearTimeout(syncAfterRestore);
      removeScrollListener();
    };
  }, [containerRef, resetKey, threshold]);

  const scrollToTop = () => {
    const target = getTarget(containerRef);
    const behavior = getScrollBehavior();

    if (target === window) {
      window.scrollTo({
        top: 0,
        behavior,
      });
    } else {
      target.scrollTo({
        top: 0,
        behavior,
      });
    }
  };

  return (
    <Button
      type="button"
      onClick={scrollToTop}
      size="icon"
      className={cn(
        "fixed z-[55] h-11 w-11 rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-[0_18px_42px_rgba(0,0,0,0.35)] shadow-primary/20 ring-1 ring-primary/20 transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_22px_50px_rgba(0,0,0,0.42)] focus-visible:ring-primary/50",
        "bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 md:bottom-6 md:right-6",
        hasBottomNav && "bottom-[calc(max(env(safe-area-inset-bottom),24px)+108px)] left-4 right-auto md:bottom-6 md:left-auto md:right-6",
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        className
      )}
      aria-label="Scroll to top"
      aria-hidden={!isVisible}
      tabIndex={isVisible ? 0 : -1}
      title="Scroll to top"
    >
      <NavArrowUp className="h-5 w-5" />
    </Button>
  );
};
