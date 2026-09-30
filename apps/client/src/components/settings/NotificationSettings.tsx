import { getApiErrorStatus } from "@/services/api/client";
import { useState, useEffect, useRef, useCallback, useId } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";
import { CurrencyIcon } from "@/components/CurrencyIcon";
import { useSettingsTask } from "@/contexts/SettingsTaskContext";
import type { User } from "@/types";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  fetchNotificationPreferences,
  saveNotificationPreferences as saveNotificationPreferencesApi,
} from "@/services/api";

interface NotificationSettingsProps {
  user: User;
}

const NotificationSettingsContent = ({ user }: NotificationSettingsProps) => {
  const { toast } = useToast();
  const { isRegistered, register, unregister, error: pushError } = usePushNotifications();
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const [savedPreferences, setSavedPreferences] = useState<typeof DEFAULT_NOTIFICATION_PREFERENCES | null>(null);
  const [pending, setPending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const mounted = useRef(false);
  const readRequest = useRef(0);
  const errorId = useId();
  useSettingsTask({ dirty: savedPreferences !== null && JSON.stringify(notificationPrefs) !== JSON.stringify(savedPreferences), pending });

  const loadNotificationPreferences = useCallback(async () => {
    if (!mounted.current || pendingRef.current) return;
    const request = ++readRequest.current;
    const isCurrent = () => mounted.current && readRequest.current === request;
    
    try {
      setLoadingPrefs(true);
      setLoadError(null);
      const preferences = await fetchNotificationPreferences(user.id);
      if (!isCurrent()) return;
      setNotificationPrefs(preferences);
      setSavedPreferences(preferences);
      setHasLoaded(true);
    } catch (error: unknown) {
      if (!isCurrent()) return;
      if ([401, 403, 404].includes(getApiErrorStatus(error) ?? 0)) { setHasLoaded(false); }
      console.error("Error loading notification preferences:", error);
      setLoadError("We couldn't load notification preferences. Please try again.");
    } finally {
      if (isCurrent()) setLoadingPrefs(false);
    }
  }, [user.id]);

  useEffect(() => {
    mounted.current = true;
    void loadNotificationPreferences();
    return () => { mounted.current = false; readRequest.current += 1; };
  }, [loadNotificationPreferences]);

  const changePushEnabled = async (checked: boolean) => {
    if (pendingRef.current) return;
    setNotificationPrefs(previous => ({ ...previous, push_enabled: checked }));
    if (checked === isRegistered) return;
    pendingRef.current = true;
    setPending(true); setSaveError(null);
    try {
      await (checked ? register() : unregister());
    } catch (error) {
      if (mounted.current) setSaveError(error instanceof Error ? error.message : "Could not update device notifications");
    } finally {
      if (mounted.current) { pendingRef.current = false; setPending(false); }
    }
  };

  const saveNotificationPreferences = async () => {
    if (!mounted.current || pendingRef.current || loadingPrefs || !hasLoaded) return;
    pendingRef.current = true;
    setPending(true); setSaveError(null);
    const submitted = { ...notificationPrefs };
    let confirmed = false;

    try {
      await saveNotificationPreferencesApi(user.id, submitted);
      if (!mounted.current) return;
      confirmed = true;
      setSavedPreferences(submitted);

      toast({
        title: "Success",
        description: "Notification preferences saved",
      });

      if (submitted.push_enabled && !isRegistered) {
        await register();
      } else if (!submitted.push_enabled && isRegistered) {
        await unregister();
      }
    } catch (error: unknown) {
      if (!mounted.current) return;
      const message = confirmed ? "Preferences saved, but device notifications could not be updated." : "Failed to save notification preferences";
      setSaveError(message);
      toast({ variant: "destructive", title: confirmed ? "Device notification issue" : "Error", description: message });
    } finally {
      if (mounted.current) { pendingRef.current = false; setPending(false); }
    }
  };

  return (
    <LoadingRegion loading={loadingPrefs && !hasLoaded} refreshing={loadingPrefs && hasLoaded} label="Loading notification preferences" className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Notification Preferences</h2>
        <p className="font-sans text-muted-foreground mt-1">
          Control how and when you receive notifications
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadError && <LoadingError message={loadError} onRetry={loadNotificationPreferences} />}
          {(!loadError || hasLoaded) && (
            <fieldset disabled={pending || loadingPrefs} className="min-w-0 space-y-6" aria-busy={pending}>
              <legend className="sr-only">Notification delivery preferences</legend>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push_enabled">Push Notifications</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Receive push notifications on your device
                    </p>
                  </div>
                  {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
                    id="push_enabled"
                    checked={notificationPrefs.push_enabled}
                    onCheckedChange={(checked) => void changePushEnabled(checked)}
                  />)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="badges_enabled">Badge Unlocks</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      New badges earned through your Reader Journey
                    </p>
                  </div>
                  {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
                    id="badges_enabled"
                    checked={notificationPrefs.badges_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, badges_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="quests_enabled">Quest Updates</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Quest reminders and completion summaries
                    </p>
                  </div>
                  {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
                    id="quests_enabled"
                    checked={notificationPrefs.quests_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, quests_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="rank_movement_enabled">Rank Movement</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Important changes in your weekly league position
                    </p>
                  </div>
                  {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
                    id="rank_movement_enabled"
                    checked={notificationPrefs.rank_movement_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, rank_movement_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="weekly_results_enabled">Weekly Results</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Final Reader League rank and promotion result
                    </p>
                  </div>
                  {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
                    id="weekly_results_enabled"
                    checked={notificationPrefs.weekly_results_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, weekly_results_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="gold_leaves_enabled" className="inline-flex items-center gap-1.5">
                      <CurrencyIcon currency="goldLeaves" />
                      Gold Leaves
                    </Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Notify me when a rare Gold Leaf is earned
                    </p>
                  </div>
                  {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
                    id="gold_leaves_enabled"
                    checked={notificationPrefs.gold_leaves_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, gold_leaves_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="messages_enabled">Messages</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Notify me when I receive new messages
                    </p>
                  </div>
                  {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
                    id="messages_enabled"
                    checked={notificationPrefs.messages_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, messages_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="followers_enabled">New Followers</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Notify me when someone follows me
                    </p>
                  </div>
                  {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
                    id="followers_enabled"
                    checked={notificationPrefs.followers_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, followers_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="book_clubs_enabled">Book Clubs</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Notify me about book club updates
                    </p>
                  </div>
                  {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
                    id="book_clubs_enabled"
                    checked={notificationPrefs.book_clubs_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, book_clubs_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="goals_enabled">Goal Milestones</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Notify me when I reach reading goals
                    </p>
                  </div>
                  {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
                    id="goals_enabled"
                    checked={notificationPrefs.goals_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, goals_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="streaks_enabled">Streak Reminders</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Remind me to maintain my reading streak
                    </p>
                  </div>
                  {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
                    id="streaks_enabled"
                    checked={notificationPrefs.streaks_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, streaks_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="reading_reminders_enabled">Reading Reminders</Label>
                    <p className="font-sans text-sm text-muted-foreground">
                      Daily reminders to read
                    </p>
                  </div>
                  {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
                    id="reading_reminders_enabled"
                    checked={notificationPrefs.reading_reminders_enabled}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs(prev => ({ ...prev, reading_reminders_enabled: checked }))
                    }
                    disabled={!notificationPrefs.push_enabled}
                  />)}
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label className="mb-3 block">Quiet Hours</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quiet_hours_start">Start</Label>
                    {!hasLoaded ? <Skeleton className="h-11 min-h-[44px] w-full" /> : (<Input
                      id="quiet_hours_start"
                      type="time"
                      value={notificationPrefs.quiet_hours_start || ""}
                      onChange={(e) =>
                        setNotificationPrefs(prev => ({ ...prev, quiet_hours_start: e.target.value || null }))
                      }
                      disabled={!notificationPrefs.push_enabled}
                    />)}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quiet_hours_end">End</Label>
                    {!hasLoaded ? <Skeleton className="h-11 min-h-[44px] w-full" /> : (<Input
                      id="quiet_hours_end"
                      type="time"
                      value={notificationPrefs.quiet_hours_end || ""}
                      onChange={(e) =>
                        setNotificationPrefs(prev => ({ ...prev, quiet_hours_end: e.target.value || null }))
                      }
                      disabled={!notificationPrefs.push_enabled}
                    />)}
                  </div>
                </div>
                <p className="font-sans text-xs text-muted-foreground mt-2">
                  Notifications will be silenced during these hours
                </p>
              </div>

              {pushError && (
                <div role="alert" className="font-sans bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                  {pushError}
                </div>
              )}

              {!hasLoaded ? <Skeleton className="h-11 min-h-[44px] w-full" /> : <Button
                onClick={saveNotificationPreferences}
                disabled={pending || loadingPrefs}
                aria-describedby={saveError ? errorId : undefined}
                className="w-full"
                variant="outline"
              >
                Save Notification Preferences
              </Button>}
            </fieldset>
          )}
        </CardContent>
      </Card>
      {pending && <p role="status" className="text-sm text-muted-foreground">Updating your notification preferences…</p>}
      {saveError && <p id={errorId} role="alert" className="text-sm text-destructive">{saveError}</p>}
    </LoadingRegion>
  );
};

export const NotificationSettings = ({ user }: NotificationSettingsProps) => <NotificationSettingsContent key={user.id} user={user} />;
