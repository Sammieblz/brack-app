import { useCallback, useRef } from 'react';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection';

// Capacitor holds one native selection generator. Keep discrete selections from
// closing each other's generator when several controls respond in one turn.
let selectionQueue: Promise<void> = Promise.resolve();

const webPatterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 50, 10],
  error: [20, 100, 20, 100, 20],
  selection: 5,
};

export const useHapticFeedback = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const triggerHaptic = useCallback(
    async (pattern: HapticPattern = 'light') => {
      try {
        if (!enabledRef.current) return;
        if (Capacitor.isNativePlatform()) {
          if (!Capacitor.isPluginAvailable('Haptics')) return;
          if (pattern === 'selection') {
            const selection = selectionQueue.then(async () => {
              if (!enabledRef.current) return;
              try {
                await Haptics.selectionStart();
                await Haptics.selectionChanged();
              } finally {
                await Haptics.selectionEnd();
              }
            });
            selectionQueue = selection.catch(() => undefined);
            await selection;
            return;
          }
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
        if (
          typeof navigator !== 'undefined' &&
          typeof navigator.vibrate === 'function' &&
          navigator.userActivation?.hasBeenActive !== false
        ) {
          const vibrationPattern = webPatterns[pattern];
          navigator.vibrate(vibrationPattern);
        }
      } catch (error) {
        console.debug('Haptic feedback not available:', error);
      }
    },
    [],
  );

  return { triggerHaptic };
};
