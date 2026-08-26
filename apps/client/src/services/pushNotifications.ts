import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

import {
  deletePushToken,
  savePushToken,
  type PushNotificationToken,
} from "@/services/api";

export type NativePushPermissionState =
  | "granted"
  | "denied"
  | "prompt"
  | "prompt-with-rationale"
  | "unavailable";

export type PushRegistrationResult =
  | { status: "registered"; token: string }
  | { status: "denied"; token: null }
  | { status: "unavailable"; token: null }
  | { status: "failed"; token: null };

const PUSH_TOKEN_STORAGE_KEY = "brack:native-push-token:v1";
let registrationPromise: Promise<PushRegistrationResult> | null = null;

const readStoredToken = () => {
  try {
    return window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

const storeToken = (token: string) => {
  try {
    window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  } catch {
    // The server registration remains valid when local persistence is unavailable.
  }
};

const clearStoredToken = () => {
  try {
    window.localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
};

const normalizeNotificationData = (data: unknown): Record<string, unknown> =>
  typeof data === "object" && data !== null
    ? (data as Record<string, unknown>)
    : {};

/**
 * Native notification registration. Firebase Messaging is used on both
 * platforms so the backend always receives an FCM registration token; the
 * stock Capacitor plugin returns an APNs token on iOS, which is not accepted by
 * Brack's FCM HTTP v1 sender.
 */
export const pushNotificationsService = {
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  },

  hasStoredRegistration(): boolean {
    return Boolean(readStoredToken());
  },

  async getPermissionState(): Promise<NativePushPermissionState> {
    if (!Capacitor.isNativePlatform()) return "unavailable";

    const support = await FirebaseMessaging.isSupported();
    if (!support.isSupported) return "unavailable";

    const status = await FirebaseMessaging.checkPermissions();
    if (status.receive !== "granted") return status.receive;

    // Permission APIs report `granted` on older Android versions even when the
    // user has disabled notification display in app settings. `areEnabled`
    // reflects that device-level switch without presenting another prompt.
    const displayStatus = await LocalNotifications.areEnabled();
    return displayStatus.value ? "granted" : "denied";
  },

  async registerWithResult(): Promise<PushRegistrationResult> {
    if (!Capacitor.isNativePlatform()) {
      return { status: "unavailable", token: null };
    }

    if (registrationPromise) return registrationPromise;

    registrationPromise = (async () => {
      try {
        const support = await FirebaseMessaging.isSupported();
        if (!support.isSupported) return { status: "unavailable", token: null };

        let permission = await FirebaseMessaging.checkPermissions();
        if (
          permission.receive === "prompt" ||
          permission.receive === "prompt-with-rationale"
        ) {
          permission = await FirebaseMessaging.requestPermissions();
        }
        if (permission.receive !== "granted") {
          return { status: "denied", token: null };
        }

        const displayStatus = await LocalNotifications.areEnabled();
        if (!displayStatus.value) return { status: "denied", token: null };

        const { token } = await FirebaseMessaging.getToken();
        if (!token) return { status: "failed", token: null };

        await this.saveTokenToDatabase({
          token,
          platform: Capacitor.getPlatform() as "ios" | "android",
        });
        storeToken(token);
        return { status: "registered", token };
      } catch (error) {
        console.error("Unable to register this device for push notifications:", error);
        return { status: "failed", token: null };
      }
    })().finally(() => {
      registrationPromise = null;
    });

    return registrationPromise;
  },

  /** Backward-compatible token-only result for settings and older callers. */
  async register(): Promise<string | null> {
    const result = await this.registerWithResult();
    return result.token;
  },

  async saveTokenToDatabase(tokenData: PushNotificationToken): Promise<void> {
    await savePushToken(tokenData);
  },

  /**
   * Release only this installation's token. This runs before Supabase sign-out
   * so the authenticated delete can succeed and account switching cannot leave
   * the device attached to the previous reader.
   */
  async unregister(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const token = readStoredToken();
    if (token) {
      try {
        await deletePushToken(token);
      } catch (error) {
        // Do not block sign-out. Global token uniqueness plus claim_push_token
        // safely transfers ownership if this installation later changes users.
        console.error("Unable to remove the current device push token:", error);
      }
    }

    try {
      await FirebaseMessaging.deleteToken();
    } catch (error) {
      console.error("Unable to delete the native FCM registration:", error);
    } finally {
      clearStoredToken();
    }
  },

  setupListeners(
    onNotificationReceived?: (notification: {
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
    }) => void,
  ): () => void {
    if (!Capacitor.isNativePlatform()) return () => {};

    let active = true;
    const listeners: PluginListenerHandle[] = [];

    void FirebaseMessaging.addListener("notificationReceived", ({ notification }) => {
      onNotificationReceived?.({
        title: notification.title,
        body: notification.body,
        data: normalizeNotificationData(notification.data),
      });
    }).then((listener) => {
      if (!active) void listener.remove();
      else listeners.push(listener);
    });

    void FirebaseMessaging.addListener(
      "notificationActionPerformed",
      ({ notification }) => {
        const data = normalizeNotificationData(notification.data);
        const destination =
          typeof data.url === "string"
            ? data.url
            : typeof notification.link === "string"
              ? notification.link
              : null;
        if (destination) window.location.assign(destination);
      },
    ).then((listener) => {
      if (!active) void listener.remove();
      else listeners.push(listener);
    });

    return () => {
      active = false;
      for (const listener of listeners) void listener.remove();
    };
  },
};
