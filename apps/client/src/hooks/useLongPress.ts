import { useCallback, useRef } from 'react';
import { useHapticFeedback } from './useHapticFeedback';

interface UseLongPressOptions {
  onLongPress: () => void;
  onClick?: () => void;
  delay?: number;
}

export const useLongPress = ({
  onLongPress,
  onClick,
  delay = 500,
}: UseLongPressOptions) => {
  const { triggerHaptic } = useHapticFeedback();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isLongPress = useRef(false);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    isLongPress.current = false;
    
    timeoutRef.current = setTimeout(() => {
      isLongPress.current = true;
      triggerHaptic('medium');
      onLongPress();
    }, delay);
  }, [onLongPress, delay, triggerHaptic]);

  const clear = useCallback((e: React.TouchEvent | React.MouseEvent, shouldTriggerClick = false) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (shouldTriggerClick && !isLongPress.current && onClick) {
      onClick();
    }
  }, [onClick]);

  return {
    onMouseDown: start,
    onMouseUp: (e: React.MouseEvent) => clear(e, true),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchStart: start,
    onTouchEnd: (e: React.TouchEvent) => clear(e, true),
  };
};
