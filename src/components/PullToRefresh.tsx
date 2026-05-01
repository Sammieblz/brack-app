import { ReactNode, useRef, useState } from "react";
import { Refresh } from "iconoir-react";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { getScrollParent, getScrollTop } from "@/utils/scroll";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
}

const PULL_THRESHOLD = 76;
const MAX_PULL_DISTANCE = 96;

export const PullToRefresh = ({ onRefresh, children, disabled = false }: PullToRefreshProps) => {
  const isMobile = useIsMobile();
  const { triggerHaptic } = useHapticFeedback();
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const trackingRef = useRef(false);
  const thresholdHapticRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const resetPull = () => {
    trackingRef.current = false;
    thresholdHapticRef.current = false;
    startYRef.current = 0;
    pullDistanceRef.current = 0;
    setPullDistance(0);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || refreshing || !isMobile || !containerRef.current) return;

    const scrollParent = getScrollParent(containerRef.current);
    if (getScrollTop(scrollParent) > 0) return;

    trackingRef.current = true;
    startYRef.current = event.touches[0].clientY;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!trackingRef.current || !containerRef.current) return;

    const scrollParent = getScrollParent(containerRef.current);
    if (getScrollTop(scrollParent) > 0) {
      resetPull();
      return;
    }

    const deltaY = event.touches[0].clientY - startYRef.current;
    if (deltaY <= 0) {
      resetPull();
      return;
    }

    const nextDistance = Math.min(MAX_PULL_DISTANCE, Math.round(deltaY * 0.45));
    pullDistanceRef.current = nextDistance;
    setPullDistance(nextDistance);

    if (nextDistance >= PULL_THRESHOLD && !thresholdHapticRef.current) {
      thresholdHapticRef.current = true;
      triggerHaptic("light");
    }
  };

  const handleTouchEnd = async () => {
    if (!trackingRef.current) return;

    const shouldRefresh = pullDistanceRef.current >= PULL_THRESHOLD;
    resetPull();

    if (!shouldRefresh) return;

    try {
      setRefreshing(true);
      triggerHaptic("medium");
      await onRefresh();
      triggerHaptic("success");
    } finally {
      setRefreshing(false);
    }
  };

  if (disabled || !isMobile) {
    return <>{children}</>;
  }

  const visibleDistance = refreshing ? 48 : pullDistance;
  const progress = Math.min(1, visibleDistance / PULL_THRESHOLD);

  return (
    <div
      ref={containerRef}
      className="relative min-h-full touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={resetPull}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 right-0 top-0 z-20 flex justify-center transition-opacity duration-150",
          visibleDistance > 4 ? "opacity-100" : "opacity-0"
        )}
        style={{
          transform: `translateY(${Math.max(0, visibleDistance - 44)}px)`,
        }}
      >
        <div className="flex h-9 items-center gap-2 rounded-full border border-border/70 bg-background/90 px-3 text-xs text-muted-foreground shadow-sm backdrop-blur">
          <Refresh
            className={cn(
              "h-4 w-4 text-primary transition-transform",
              refreshing && "animate-spin"
            )}
            style={{
              transform: refreshing ? undefined : `rotate(${Math.round(progress * 180)}deg)`,
            }}
          />
          <span>{refreshing ? "Refreshing" : progress >= 1 ? "Release to refresh" : "Pull to refresh"}</span>
        </div>
      </div>
      {children}
    </div>
  );
};
