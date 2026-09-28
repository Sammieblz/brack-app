import { supabase } from "@/integrations/supabase/client";
import { getCurrentAuthUser } from "./auth";

export interface GamificationNotification {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

const assertExpectedReader = async (expectedUserId: string) => {
  const user = await getCurrentAuthUser();
  if (!expectedUserId || user?.id !== expectedUserId) {
    throw new Error("Reader changed. Reopen notifications to continue.");
  }
};

export const getUserNotifications = async (
  expectedUserId: string,
  signal?: AbortSignal
): Promise<GamificationNotification[]> => {
  await assertExpectedReader(expectedUserId);
  let request = supabase
    .from("user_notifications")
    .select("id,notification_type,title,body,data,read_at,created_at")
    .eq("user_id", expectedUserId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;
  await assertExpectedReader(expectedUserId);
  return (data || []) as GamificationNotification[];
};

export const markUserNotificationRead = async (
  notificationId: string,
  expectedUserId: string
) => {
  await assertExpectedReader(expectedUserId);
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", expectedUserId);
  if (error) throw error;
  await assertExpectedReader(expectedUserId);
};

export const markAllUserNotificationsRead = async (expectedUserId: string) => {
  await assertExpectedReader(expectedUserId);
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .eq("user_id", expectedUserId);
  if (error) throw error;
  await assertExpectedReader(expectedUserId);
};
