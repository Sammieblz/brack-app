import React, { useEffect, useState, useCallback } from 'react';
import { pushNotificationsService } from '@/services/pushNotifications';
import { toast } from "sonner";
import { NewBadgeToast } from "@/components/NewBadgeToast";

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
    if (!pushNotificationsService.isNative()) {
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
    if (!pushNotificationsService.isNative()) return;

    const cleanup = pushNotificationsService.setupListeners((notification) => {
      console.log('Notification received:', notification);

      const data = notification.data || {};

      if (data.type === "badge_earned") {
        const badgeTitle = String(data.badgeTitle ?? "");
        const badgeDescription =
          typeof data.badgeDescription === "string" ? data.badgeDescription : null;
        const badgeImageUrl =
          typeof data.badgeImageUrl === "string" ? data.badgeImageUrl : null;

        toast.custom(() =>
          React.createElement(NewBadgeToast, {
            badge: {
              id: String(data.badgeId ?? "badge"),
              title: badgeTitle,
              description: badgeDescription,
              icon_url: badgeImageUrl,
              created_at: "",
            },
          })
        );
      }
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
