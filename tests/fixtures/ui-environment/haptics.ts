// Runtime policy tests do not invoke native effects; F04 owns haptic evidence.
export const useHapticFeedback = () => ({ triggerHaptic: () => undefined });
