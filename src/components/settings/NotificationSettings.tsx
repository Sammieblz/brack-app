import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { User } from "@/types";

interface NotificationSettingsProps {
  user: User;
}

export const NotificationSettings = ({ user }: NotificationSettingsProps) => {
  const { toast } = useToast();
  const { isRegistered, register, unregister, error: pushError } = usePushNotifications();
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [notificationPrefs, setNotificationPrefs] = useState({
    push_enabled: true,
    messages_enabled: true,
    followers_enabled: true,
    book_clubs_enabled: true,
    goals_enabled: true,
    streaks_enabled: true,
    reading_reminders_enabled: false,
    quiet_hours_start: null as string | null,
    quiet_hours_end: null as string | null,
  });

  useEffect(() => {
    loadNotificationPreferences();
  }, [user]);

  const loadNotificationPreferences = async () => {
    if (!user) return;
    
    try {
      setLoadingPrefs(true);
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setNotificationPrefs({
          push_enabled: data.push_enabled ?? true,
          messages_enabled: data.messages_enabled ?? true,
          followers_enabled: data.followers_enabled ?? true,
          book_clubs_enabled: data.book_clubs_enabled ?? true,
          goals_enabled: data.goals_enabled ?? true,
          streaks_enabled: data.streaks_enabled ?? true,
          reading_reminders_enabled: data.reading_reminders_enabled ?? false,
          quiet_hours_start: data.quiet_hours_start || null,
          quiet_hours_end: data.quiet_hours_end || null,
        });
      }
    } catch (error: unknown) {
      console.error("Error loading notification preferences:", error);
    } finally {
      setLoadingPrefs(false);
    }
  };

  const saveNotificationPreferences = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user.id,
          ...notificationPrefs,
        }, {
          onConflict: "user_id",
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Notification preferences saved",
      });

      if (notificationPrefs.push_enabled && !isRegistered) {
        await register();
      } else if (!notificationPrefs.push_enabled && isRegistered) {
        await unregister();
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save notification preferences",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Notification Preferences</h2>
        <p className="font-sans text-muted-foreground mt-1">
          Control how and when you receive notifications
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingPrefs ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push_enabled">Push Notifications</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Receive push notifications on your device
                    </p>
                  </div>
                  <Switch
                    id="push_enabled"
                    checked={notificationPrefs.push_enabled}
                    onCheckedChange={(checked) => {
                      setNotificationPrefs(prev => ({ ...prev, push_enabled: checked }));
                      if (checked && !isRegistered) {
                        register().catch(console.error);
                      } else if (!checked && isRegistered) {
                        unregister().catch(console.error);
                      }
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="messages_enabled">Messages</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Notify me when I receive new messages
                    </p>
                  </div>
                  <Switch
                    id="messages_enabled"
                    checked={notificationPrefs.messages_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, messages_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="followers_enabled">New Followers</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Notify me when someone follows me
                    </p>
                  </div>
                  <Switch
                    id="followers_enabled"
                    checked={notificationPrefs.followers_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, followers_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="book_clubs_enabled">Book Clubs</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Notify me about book club updates
                    </p>
                  </div>
                  <Switch
                    id="book_clubs_enabled"
                    checked={notificationPrefs.book_clubs_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, book_clubs_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="goals_enabled">Goal Milestones</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Notify me when I reach reading goals
                    </p>
                  </div>
                  <Switch
                    id="goals_enabled"
                    checked={notificationPrefs.goals_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, goals_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="streaks_enabled">Streak Reminders</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Remind me to maintain my reading streak
                    </p>
                  </div>
                  <Switch
                    id="streaks_enabled"
                    checked={notificationPrefs.streaks_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, streaks_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="reading_reminders_enabled">Reading Reminders</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Daily reminders to read
                    </p>
                  </div>
                  <Switch
                    id="reading_reminders_enabled"
                    checked={notificationPrefs.reading_reminders_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, reading_reminders_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label className="mb-3 block">Quiet Hours</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quiet_hours_start">Start</Label>
                    <Input
                      id="quiet_hours_start"
                      type="time"
                      value={notificationPrefs.quiet_hours_start || ""}
                      onChange={(e) =>
                        setNotificationPrefs(prev => ({ ...prev, quiet_hours_start: e.target.value || null }))
                      }
                      disabled={!notificationPrefs.push_enabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quiet_hours_end">End</Label>
                    <Input
                      id="quiet_hours_end"
                      type="time"
                      value={notificationPrefs.quiet_hours_end || ""}
                      onChange={(e) =>
                        setNotificationPrefs(prev => ({ ...prev, quiet_hours_end: e.target.value || null }))
                      }
                      disabled={!notificationPrefs.push_enabled}
                    />
                  </div>
                </div>
                <p className="font-sans text-xs text-muted-foreground mt-2">
                  Notifications will be silenced during these hours
                </p>
              </div>

              {pushError && (
                <div className="font-sans bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                  {pushError}
                </div>
              )}

              <Button
                onClick={saveNotificationPreferences}
                className="w-full"
                variant="outline"
              >
                Save Notification Preferences
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
