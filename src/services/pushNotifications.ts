import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

interface PushNotificationToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
}

/**
 * Push notifications service
 * Handles registration, token management, and notification events
 */
export const pushNotificationsService = {
  /**
   * Register for push notifications
   */
  async register(): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only available on native platforms');
      return null;
    }

    try {
      // Request permissions
      const permResult = await PushNotifications.requestPermissions();
      if (!permResult.receive) {
        console.log('Push notification permission denied');
        return null;
      }

      // Register with APNs/FCM
      await PushNotifications.register();

      // Wait for registration token
      return new Promise((resolve) => {
        const tokenListener = PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token: ' + token.value);
          
          // Save token to database
          await this.saveTokenToDatabase({
            token: token.value,
            platform: Capacitor.getPlatform() as 'ios' | 'android',
          });

          tokenListener.remove();
          resolve(token.value);
        });

        const errorListener = PushNotifications.addListener('registrationError', (error) => {
          console.error('Error on registration: ' + JSON.stringify(error));
          errorListener.remove();
          resolve(null);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          tokenListener.remove();
          errorListener.remove();
          resolve(null);
        }, 10000);
      });
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  },

  /**
   * Save push token to database
   */
  async saveTokenToDatabase(tokenData: PushNotificationToken): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if token already exists
      const { data: existing } = await supabase
        .from('push_tokens')
        .select('id')
        .eq('user_id', user.id)
        .eq('token', tokenData.token)
        .maybeSingle();

      if (!existing) {
        // Insert new token
        await supabase.from('push_tokens').insert({
          user_id: user.id,
          token: tokenData.token,
          platform: tokenData.platform,
        });
      }
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  },

  /**
   * Unregister from push notifications
   */
  async unregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Remove all tokens for this user
      await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', user.id);

      // Unregister from push service
      await PushNotifications.unregister();
    } catch (error) {
      console.error('Error unregistering push notifications:', error);
    }
  },

  /**
   * Set up notification listeners
   */
  setupListeners(onNotificationReceived?: (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => void): () => void {
    if (!Capacitor.isNativePlatform()) {
      return () => {}; // Return no-op cleanup
    }

    // Handle notification received while app is in foreground
    const receivedListener = PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received: ', notification);
      onNotificationReceived?.(notification);
    });

    // Handle notification action (tap)
    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push notification action performed: ', action);
      // Handle navigation based on notification data
      if (action.notification.data?.url) {
        window.location.href = action.notification.data.url;
      }
    });

    // Return cleanup function
    return () => {
      receivedListener.remove();
      actionListener.remove();
    };
  },
};
