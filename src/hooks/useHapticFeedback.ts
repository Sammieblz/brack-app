import { useCallback } from 'react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection';

const webPatterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 50, 10],
  error: [20, 100, 20, 100, 20],
  selection: 5,
};

export const useHapticFeedback = () => {
  const isNative = Capacitor.isNativePlatform();

  const canVibrateWeb = () => {
    const activation = (navigator as any).userActivation;
    if (activation && activation.hasBeenActive === false) return false;
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  };

  const triggerHaptic = useCallback(
    async (pattern: HapticPattern = 'light') => {
      try {
        if (isNative) {
          if (pattern === 'success' || pattern === 'error') {
            await Haptics.notification({
              type: pattern === 'success' ? NotificationType.Success : NotificationType.Error,
            });
            return;
          }

          await Haptics.impact({
            style:
              pattern === 'light'
                ? ImpactStyle.Light
                : pattern === 'medium'
                ? ImpactStyle.Medium
                : ImpactStyle.Heavy,
          });
          return;
        }

        // On web, vibration requires a prior user gesture; silently skip if not allowed yet.
        if (canVibrateWeb()) {
          const vibrationPattern = webPatterns[pattern];
          navigator.vibrate(vibrationPattern);
        }
      } catch (error) {
        console.debug('Haptic feedback not available:', error);
      }
    },
    [isNative],
  );

  return { triggerHaptic };
};
