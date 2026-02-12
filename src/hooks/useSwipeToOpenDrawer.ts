import { useEffect, useRef } from 'react';
import { usePlatform } from '@/hooks/usePlatform';

interface UseSwipeToOpenDrawerOptions {
  onSwipeOpen: () => void;
  enabled?: boolean;
  edgeThreshold?: number; // Distance from right edge to trigger (default 20px)
  swipeThreshold?: number; // Minimum swipe distance to trigger (default 100px)
}

/**
 * Hook to detect swipe from right edge to open a drawer
 * Only triggers when enabled and doesn't conflict with browser back gesture
 */
export const useSwipeToOpenDrawer = ({
  onSwipeOpen,
  enabled = true,
  edgeThreshold = 20,
  swipeThreshold = 100,
}: UseSwipeToOpenDrawerOptions) => {
  const { isMobile } = usePlatform();
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isTouchingEdge = useRef<boolean>(false);
  const isVerticalScroll = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled || !isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      
      // Check if touch started near right edge (within threshold)
      const rightEdge = window.innerWidth - edgeThreshold;
      isTouchingEdge.current = touch.clientX > rightEdge;
      isVerticalScroll.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchingEdge.current) return;

      const touch = e.touches[0];
      const deltaX = touchStartX.current - touch.clientX; // Negative for left swipe
      const deltaY = Math.abs(touch.clientY - touchStartY.current);

      // If vertical movement is greater, it's a scroll - cancel
      if (deltaY > Math.abs(deltaX) && deltaY > 10) {
        isVerticalScroll.current = true;
        isTouchingEdge.current = false;
        return;
      }

      // Only track left swipes (negative deltaX) from right edge
      if (deltaX > 0 && !isVerticalScroll.current) {
        // Prevent default to stop scroll when swiping left
        if (deltaX > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isTouchingEdge.current || isVerticalScroll.current) {
        isTouchingEdge.current = false;
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touchStartX.current - touch.clientX; // Negative for left swipe

      // If swiped left enough, trigger open
      if (deltaX >= swipeThreshold) {
        onSwipeOpen();
      }

      isTouchingEdge.current = false;
      isVerticalScroll.current = false;
    };

    // Use passive: false for touchmove to allow preventDefault
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, isMobile, onSwipeOpen, edgeThreshold, swipeThreshold]);
};
