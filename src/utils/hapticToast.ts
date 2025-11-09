import { toast } from 'sonner';

// Trigger haptic feedback
const triggerHaptic = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (error) {
      // Silently fail
    }
  }
};

// Toast with haptic feedback
export const hapticToast = {
  success: (message: string, description?: string) => {
    triggerHaptic([10, 50, 10]);
    return toast.success(message, description ? { description } : undefined);
  },
  
  error: (message: string, description?: string) => {
    triggerHaptic([20, 100, 20, 100, 20]);
    return toast.error(message, description ? { description } : undefined);
  },
  
  info: (message: string, description?: string) => {
    triggerHaptic(10);
    return toast.info(message, description ? { description } : undefined);
  },
  
  warning: (message: string, description?: string) => {
    triggerHaptic(20);
    return toast.warning(message, description ? { description } : undefined);
  },
};
