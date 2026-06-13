import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlatform } from './usePlatform';

interface SwipeBackState {
  isSwiping: boolean;
  swipeDistance: number;
  canGoBack: boolean;
}

export const useSwipeBack = (enabled: boolean = true) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isIOS, isMobile } = usePlatform();
  const [swipeState, setSwipeState] = useState<SwipeBackState>({
    isSwiping: false,
    swipeDistance: 0,
    canGoBack: false,
  });

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isTouchingEdge = useRef<boolean>(false);
  const isVerticalScroll = useRef<boolean>(false);

  useEffect(() => {
    // Only enable on iOS/mobile and when enabled
    if (!enabled || (!isIOS && !isMobile)) return;

    // Check if we can go back (not on root path)
    const canGoBack = window.history.length > 1 && location.pathname !== '/';
    
    if (!canGoBack) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      
      // Check if touch started near left edge (within 20px)
      isTouchingEdge.current = touch.clientX < 20;
      isVerticalScroll.current = false;

      if (isTouchingEdge.current) {
        setSwipeState(prev => ({ ...prev, canGoBack: true }));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTouchingEdge.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);

      // If vertical movement is greater, it's a scroll
      if (deltaY > Math.abs(deltaX) && deltaY > 10) {
        isVerticalScroll.current = true;
        isTouchingEdge.current = false;
        setSwipeState({ isSwiping: false, swipeDistance: 0, canGoBack: true });
        return;
      }

      // Only track right swipes (positive deltaX)
      if (deltaX > 0 && !isVerticalScroll.current) {
        // Prevent default to stop any scroll
        if (deltaX > 10) {
          e.preventDefault();
        }

        const distance = Math.min(deltaX, window.innerWidth);
        setSwipeState({
          isSwiping: true,
          swipeDistance: distance,
          canGoBack: true,
        });
      }
    };

    const handleTouchEnd = () => {
      if (!isTouchingEdge.current || isVerticalScroll.current) {
        setSwipeState({ isSwiping: false, swipeDistance: 0, canGoBack: true });
        return;
      }

      const threshold = window.innerWidth * 0.3; // 30% of screen width

      if (swipeState.swipeDistance > threshold) {
        // Complete the navigation
        setSwipeState({ isSwiping: false, swipeDistance: window.innerWidth, canGoBack: true });
        setTimeout(() => {
          navigate(-1);
        }, 200);
      } else {
        // Cancel the swipe
        setSwipeState({ isSwiping: false, swipeDistance: 0, canGoBack: true });
      }

      isTouchingEdge.current = false;
      isVerticalScroll.current = false;
    };

    // Use passive: false to allow preventDefault
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, isIOS, isMobile, location.pathname, navigate, swipeState.swipeDistance]);

  return swipeState;
};
