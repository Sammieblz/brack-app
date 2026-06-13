import { useRef, useState, useCallback, useEffect } from 'react';
import { usePlatform } from './usePlatform';

interface PullToDismissOptions {
  onDismiss: () => void;
  threshold?: number;
  enabled?: boolean;
  rubberBandEffect?: boolean;
}

interface PullToDismissState {
  isPulling: boolean;
  pullDistance: number;
  shouldDismiss: boolean;
}

export const usePullToDismiss = ({
  onDismiss,
  threshold = 100,
  enabled = true,
  rubberBandEffect = true,
}: PullToDismissOptions) => {
  const { isIOS, isMobile } = usePlatform();
  const [pullState, setPullState] = useState<PullToDismissState>({
    isPulling: false,
    pullDistance: 0,
    shouldDismiss: false,
  });

  const touchStartY = useRef<number>(0);
  const scrollTopStart = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    touchStartY.current = touch.clientY;
    
    // Check if content is scrolled to top
    const scrollContainer = containerRef.current?.querySelector('[data-pull-dismiss-content]');
    scrollTopStart.current = scrollContainer?.scrollTop || 0;
  }, [enabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartY.current;

    // Only allow pull-down when at the top of scroll
    if (scrollTopStart.current > 5) return;

    // Only track downward pulls
    if (deltaY > 0) {
      e.preventDefault();

      // Apply rubber band effect: distance increases at a decreasing rate
      let distance = deltaY;
      if (rubberBandEffect) {
        // Rubber band formula: reduces pull effect as distance increases
        const rubberBandFactor = 0.5;
        distance = deltaY * rubberBandFactor + (deltaY * (1 - rubberBandFactor)) / (1 + deltaY / 200);
      }

      const shouldDismiss = distance > threshold;

      setPullState({
        isPulling: true,
        pullDistance: distance,
        shouldDismiss,
      });
    }
  }, [enabled, threshold, rubberBandEffect]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled) return;

    if (pullState.shouldDismiss) {
      // Animate out and dismiss
      setPullState(prev => ({ ...prev, isPulling: false }));
      setTimeout(() => {
        onDismiss();
      }, 200);
    } else {
      // Snap back
      setPullState({
        isPulling: false,
        pullDistance: 0,
        shouldDismiss: false,
      });
    }
  }, [enabled, pullState.shouldDismiss, onDismiss]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled || (!isIOS && !isMobile)) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, isIOS, isMobile, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    containerRef,
    pullState,
  };
};
