import { supabase } from "@/integrations/supabase/client";

export interface GamificationNotification {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export const getUserNotifications = async (): Promise<GamificationNotification[]> => {
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id,notification_type,title,body,data,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data || []) as GamificationNotification[];
};

export const markUserNotificationRead = async (notificationId: string) => {
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw error;
};

export const markAllUserNotificationsRead = async () => {
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
};
