import { invokeFunction } from "./client";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentAuthUser } from "./auth";

export interface PushNotificationPayload {
  user_ids: string[];
  notification: {
    title: string;
    body: string;
    image?: string;
    data?: Record<string, unknown>;
  };
}

export const sendPushNotification = async <T = unknown>(
  payload: PushNotificationPayload
): Promise<T> => {
  return invokeFunction<T>("send-push-notification", {
    body: payload,
  });
};

export interface PushNotificationToken {
  token: string;
  platform: "ios" | "android" | "web";
}

export interface NotificationPreferences {
  push_enabled: boolean;
  messages_enabled: boolean;
  followers_enabled: boolean;
  book_clubs_enabled: boolean;
  goals_enabled: boolean;
  streaks_enabled: boolean;
  reading_reminders_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  push_enabled: true,
  messages_enabled: true,
  followers_enabled: true,
  book_clubs_enabled: true,
  goals_enabled: true,
  streaks_enabled: true,
  reading_reminders_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
};

export const fetchNotificationPreferences = async (
  userId: string
): Promise<NotificationPreferences> => {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;

  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES;

  return {
    push_enabled: data.push_enabled ?? true,
    messages_enabled: data.messages_enabled ?? true,
    followers_enabled: data.followers_enabled ?? true,
    book_clubs_enabled: data.book_clubs_enabled ?? true,
    goals_enabled: data.goals_enabled ?? true,
    streaks_enabled: data.streaks_enabled ?? true,
    reading_reminders_enabled: data.reading_reminders_enabled ?? false,
    quiet_hours_start: data.quiet_hours_start || null,
    quiet_hours_end: data.quiet_hours_end || null,
  };
};

export const saveNotificationPreferences = async (
  userId: string,
  preferences: NotificationPreferences
): Promise<void> => {
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        ...preferences,
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
};

export const savePushToken = async (
  tokenData: PushNotificationToken
): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("push_tokens")
    .select("id")
    .eq("user_id", user.id)
    .eq("token", tokenData.token)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase.from("push_tokens").insert({
    user_id: user.id,
    token: tokenData.token,
    platform: tokenData.platform,
  });

  if (error) throw error;
};

export const deleteCurrentUserPushTokens = async (): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) return;

  const { error } = await supabase
    .from("push_tokens")
    .delete()
    .eq("user_id", user.id);

  if (error) throw error;
};
