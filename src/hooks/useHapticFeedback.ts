import { useCallback } from 'react';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection';

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 50, 10],
  error: [20, 100, 20, 100, 20],
  selection: 5,
};

export const useHapticFeedback = () => {
  const triggerHaptic = useCallback((pattern: HapticPattern = 'light') => {
    // Check if vibration API is supported
    if (!('vibrate' in navigator)) {
      return;
    }

    try {
      const vibrationPattern = patterns[pattern];
      navigator.vibrate(vibrationPattern);
    } catch (error) {
      // Silently fail if vibration is not supported or blocked
      console.debug('Haptic feedback not available:', error);
    }
  }, []);

  return { triggerHaptic };
};
