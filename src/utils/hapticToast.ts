import { toast } from '@/hooks/use-toast';

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
    return toast({
      title: message,
      description,
      variant: 'success' as any,
    });
  },
  
  error: (message: string, description?: string) => {
    triggerHaptic([20, 100, 20, 100, 20]);
    return toast({
      title: message,
      description,
      variant: 'destructive',
    });
  },
  
  info: (message: string, description?: string) => {
    triggerHaptic(10);
    return toast({
      title: message,
      description,
      variant: 'default',
    });
  },
  
  warning: (message: string, description?: string) => {
    triggerHaptic(20);
    return toast({
      title: message,
      description,
      variant: 'warning' as any,
    });
  },
};
