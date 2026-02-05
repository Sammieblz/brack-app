import { useEffect, useState, useCallback } from 'react';
import { pushNotificationsService } from '@/services/pushNotifications';
import { Capacitor } from '@capacitor/core';

interface UsePushNotificationsReturn {
  isRegistered: boolean;
  token: string | null;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  error: string | null;
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      setError('Push notifications only available on native platforms');
      return;
    }

    try {
      setError(null);
      const tokenValue = await pushNotificationsService.register();
      if (tokenValue) {
        setToken(tokenValue);
        setIsRegistered(true);
      } else {
        setError('Failed to register for push notifications');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register for push notifications');
      setIsRegistered(false);
    }
  }, []);

  const unregister = useCallback(async () => {
    try {
      await pushNotificationsService.unregister();
      setToken(null);
      setIsRegistered(false);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to unregister from push notifications');
    }
  }, []);

  // Set up notification listeners
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const cleanup = pushNotificationsService.setupListeners((notification) => {
      console.log('Notification received:', notification);
      // Handle notification display (toast, etc.)
    });

    return cleanup;
  }, []);

  return {
    isRegistered,
    token,
    register,
    unregister,
    error,
  };
};
