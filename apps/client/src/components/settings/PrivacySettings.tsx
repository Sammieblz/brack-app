import { getApiErrorStatus } from "@/services/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { SupportPageLink } from "@/components/SupportPageLink";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  getBlockedUsers,
  unblockUser,
  updatePresence,
  updateGamificationSettings,
  type BlockedUser,
  type ReaderStatusBadge,
} from "@/services/api";
import type { User } from "@/types";
import { invalidateDashboardHomeQueries } from "@/lib/dashboardQueries";
import { toast } from "sonner";
import { useSettingsLeave, useSettingsTask } from "@/contexts/SettingsTaskContext";

interface PrivacySettingsProps {
  user: User;
}

const initials = (name?: string | null) =>
  (name || "Reader")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const PrivacySettingsContent = ({ user }: PrivacySettingsProps) => {
  const id = useId();
  const leave = useSettingsLeave();
  const queryClient = useQueryClient();
  const [publicProfile, setPublicProfile] = useState(true);
  const [showReadingActivity, setShowReadingActivity] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [readerStatus, setReaderStatus] = useState<ReaderStatusBadge>("available");
  const [showLocation, setShowLocation] = useState(true);
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(false);
  const [gamificationProfileVisible, setGamificationProfileVisible] = useState(true);
  const [hasSavedLocation, setHasSavedLocation] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const mounted = useRef(false);
  const readRequest = useRef(0);
  useSettingsTask({ dirty: false, pending });

  const loadPrivacy = useCallback(async () => {
    if (!mounted.current || pendingRef.current) return;
    const request = ++readRequest.current;
    const isCurrent = () => mounted.current && readRequest.current === request;
    try {
      setLoading(true);
      setLoadError(null);
      const [{ data: profile, error }, blocks] = await Promise.all([
        supabase
          .from("profiles")
          .select("profile_visibility, show_reading_activity, show_online_status, reader_status, show_location, latitude, longitude, leaderboard_opt_in, gamification_profile_visible")
          .eq("id", user.id)
          .maybeSingle(),
        getBlockedUsers(),
      ]);
      if (!isCurrent()) return;
      if (error) throw error;

      setPublicProfile((profile?.profile_visibility || "public") === "public");
      setShowReadingActivity(profile?.show_reading_activity ?? true);
      setShowOnlineStatus(profile?.show_online_status ?? true);
      setReaderStatus((profile?.reader_status as ReaderStatusBadge | null) ?? "available");
      setShowLocation(profile?.show_location ?? true);
      setLeaderboardOptIn(profile?.leaderboard_opt_in ?? false);
      setGamificationProfileVisible(profile?.gamification_profile_visible ?? true);
      setHasSavedLocation(profile?.latitude != null && profile?.longitude != null);
      setBlockedUsers(blocks);
      setHasLoaded(true);
    } catch (error) {
      if (!isCurrent()) return;
      if ([401, 403, 404].includes(getApiErrorStatus(error) ?? 0)) { setHasLoaded(false); setBlockedUsers([]); }
      console.error("Failed to load privacy settings", error);
      toast.error("Failed to load privacy settings");
      setLoadError("We couldn't load privacy settings. Please try again.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    mounted.current = true;
    void loadPrivacy();
    return () => { mounted.current = false; readRequest.current += 1; };
  }, [loadPrivacy]);

  const updateSetting = async <T,>({ apply, save, rollback, success, failure }: {
    apply: () => void;
    save: () => Promise<T>;
    rollback: () => void;
    success?: (result: T) => void | Promise<void>;
    failure: string;
  }) => {
    if (pendingRef.current || !mounted.current || !hasLoaded || loading) return;
    pendingRef.current = true;
    setPending(true); setMutationError(null);
    apply();
    try {
      const result = await save();
      if (mounted.current) await success?.(result);
    } catch {
      if (!mounted.current) return;
      rollback(); setMutationError(failure); toast.error(failure);
    } finally {
      if (mounted.current) { pendingRef.current = false; setPending(false); }
    }
  };

  const updateProfilePrivacy = async (updates: Record<string, unknown>) => {
    const { error } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) throw error;
  };

  const togglePublicProfile = async (checked: boolean) => {
    const previous = publicProfile;
    await updateSetting({ apply: () => setPublicProfile(checked), save: () => updateProfilePrivacy({ profile_visibility: checked ? "public" : "private" }), rollback: () => setPublicProfile(previous), failure: "Failed to update profile visibility" });
  };

  const toggleReadingActivity = async (checked: boolean) => {
    const previous = showReadingActivity;
    await updateSetting({ apply: () => setShowReadingActivity(checked), save: () => updateProfilePrivacy({ show_reading_activity: checked }), rollback: () => setShowReadingActivity(previous), success: () => { toast.success(checked ? "Activity sharing enabled" : "Activity sharing disabled"); }, failure: "Failed to update activity privacy" });
  };

  const toggleOnlineStatus = async (checked: boolean) => {
    const previous = showOnlineStatus;
    await updateSetting({
      apply: () => setShowOnlineStatus(checked),
      save: () => updateProfilePrivacy({
        show_online_status: checked,
        last_seen_at: checked ? new Date().toISOString() : null,
      }),
      rollback: () => setShowOnlineStatus(previous),
      success: async () => {
        if (checked) {
          try { await updatePresence(); }
          catch {
            if (mounted.current) {
              const message = "Online status preference saved, but your current presence could not refresh.";
              setMutationError(message); toast.error(message);
            }
            return;
          }
        }
        if (mounted.current) toast.success(checked ? "Online status enabled" : "Online status hidden");
      },
      failure: "Failed to update online status",
    });
  };

  const updateReaderStatus = async (value: ReaderStatusBadge) => {
    const previous = readerStatus;
    await updateSetting({ apply: () => setReaderStatus(value), save: () => updatePresence(value), rollback: () => setReaderStatus(previous), success: () => { toast.success("Reader status updated"); }, failure: "Failed to update reader status" });
  };

  const toggleLocation = async (checked: boolean) => {
    const previous = showLocation;
    await updateSetting({ apply: () => setShowLocation(checked), save: () => updateProfilePrivacy({ show_location: checked }), rollback: () => setShowLocation(previous), success: () => {
      if (checked && !hasSavedLocation) {
        toast.info("Add your city or current location from Personal Info to appear nearby.");
      } else {
        toast.success(checked ? "Nearby discovery enabled" : "Nearby discovery hidden");
      }
    }, failure: "Failed to update location privacy" });
  };

  const toggleLeaderboard = async (checked: boolean) => {
    const previous = leaderboardOptIn;
    await updateSetting({ apply: () => setLeaderboardOptIn(checked), save: () => updateGamificationSettings({ leaderboard_opt_in: checked }), rollback: () => setLeaderboardOptIn(previous), success: (response) => {
      void invalidateDashboardHomeQueries(queryClient, user.id);
      toast.success(
        checked
          ? response.leaderboard_eligible_from
            ? `Your first league begins the week of ${new Date(
                `${response.leaderboard_eligible_from}T00:00:00`,
              ).toLocaleDateString()}.`
            : "Reader Leagues enabled"
          : "Reader Leagues disabled",
      );
    }, failure: "Failed to update Reader League participation" });
  };

  const toggleGamificationVisibility = async (checked: boolean) => {
    const previous = gamificationProfileVisible;
    await updateSetting({ apply: () => setGamificationProfileVisible(checked), save: () => updateGamificationSettings({ gamification_profile_visible: checked }), rollback: () => setGamificationProfileVisible(previous), success: () => {
      void invalidateDashboardHomeQueries(queryClient, user.id);
      toast.success(checked ? "Journey details are visible" : "Journey details are private");
    }, failure: "Failed to update Journey visibility" });
  };

  const handleUnblock = async (userId: string) => {
    const previous = blockedUsers;
    await updateSetting({ apply: () => setBlockedUsers(current => current.filter(blocked => blocked.user_id !== userId)), save: () => unblockUser(userId), rollback: () => setBlockedUsers(previous), success: () => { toast.success("Reader unblocked"); }, failure: "Failed to unblock reader" });
  };

  return (
    <LoadingRegion loading={loading && !hasLoaded} refreshing={loading && hasLoaded} label="Loading privacy settings" className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Privacy Settings</h2>
        <p className="font-sans text-muted-foreground mt-1">
          Control who can see you, your activity, and your social interactions.
        </p>
        <SupportPageLink section="privacy" beforeNavigate={leave} className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring">Privacy information and support</SupportPageLink>
      </div>

      {loadError && <LoadingError message={loadError} onRetry={loadPrivacy} />}
      {mutationError && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{mutationError}</p>}
      {pending && <p role="status" className="text-sm text-muted-foreground">Saving your privacy preference…</p>}
      {(!loadError || hasLoaded) && <fieldset disabled={pending} aria-busy={pending} aria-describedby={mutationError ? `${id}-error` : undefined} className="min-w-0 space-y-6">
      <legend className="sr-only">Privacy and discovery controls</legend>
      <Card>
        <CardHeader>
          <CardTitle>Profile Visibility</CardTitle>
          <CardDescription>
            Profile and activity visibility now affects Feed, Readers, and shared posts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={`${id}-public`}>Public Profile</Label>
              <p className="font-sans text-sm text-muted-foreground">
                Allow readers to find and view your profile.
              </p>
            </div>
            {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
              id={`${id}-public`}
              checked={publicProfile}
              disabled={loading}
              onCheckedChange={togglePublicProfile}
            />)}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={`${id}-activity`}>Show Reading Activity</Label>
              <p className="font-sans text-sm text-muted-foreground">
                Include your reading updates in mutual-friend Activity feeds.
              </p>
            </div>
            {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
              id={`${id}-activity`}
              checked={showReadingActivity}
              disabled={loading}
              onCheckedChange={toggleReadingActivity}
            />)}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={`${id}-location`}>Show Location</Label>
              <p className="font-sans text-sm text-muted-foreground">
                Allow your saved location to be used for nearby reader discovery.
              </p>
              {!hasSavedLocation && showLocation && (
                <p className="font-sans text-xs text-muted-foreground">
                  No saved coordinates yet. Add them from Personal Info.
                </p>
              )}
            </div>
            {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch id={`${id}-location`} checked={showLocation} disabled={loading} onCheckedChange={toggleLocation} />)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reader Journey & Rankings</CardTitle>
          <CardDescription>
            Ink and quests remain available even when public competition is disabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={`${id}-leagues`}>Join Reader Leagues</Label>
              <p className="font-sans text-sm text-muted-foreground">
                Enter optional weekly leagues using qualifying reading activity. New opt-ins start next week.
              </p>
            </div>
            {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
              id={`${id}-leagues`}
              checked={leaderboardOptIn}
              disabled={loading}
              onCheckedChange={toggleLeaderboard}
            />)}
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={`${id}-journey`}>Show Journey on Profile</Label>
              <p className="font-sans text-sm text-muted-foreground">
                Let eligible readers see your level and league rank.
              </p>
            </div>
            {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
              id={`${id}-journey`}
              checked={gamificationProfileVisible}
              disabled={loading}
              onCheckedChange={toggleGamificationVisibility}
            />)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Presence & Discovery</CardTitle>
          <CardDescription>
            Control how readers see your availability in Discover.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor={`${id}-online`}>Show Online Status</Label>
              <p className="font-sans text-sm text-muted-foreground">
                Let mutual friends see when you are active in Brack.
              </p>
            </div>
            {!hasLoaded ? <Skeleton className="h-6 w-11 shrink-0 rounded-full" /> : (<Switch
              id={`${id}-online`}
              checked={showOnlineStatus}
              disabled={loading}
              onCheckedChange={toggleOnlineStatus}
            />)}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`${id}-status`}>Reader Status Badge</Label>
            {!hasLoaded ? <Skeleton className="h-10 min-h-[44px] w-full max-w-md" /> : (<Select
              value={readerStatus}
              onValueChange={(value) => updateReaderStatus(value as ReaderStatusBadge)}
              disabled={loading || pending}
            >
              <SelectTrigger id={`${id}-status`} className="max-w-md">
                <SelectValue placeholder="Choose a reader status" />
              </SelectTrigger>
              <SelectContent>
                {READER_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>)}
            <p className="font-sans text-sm text-muted-foreground">
              This badge appears on your profile and discovery cards.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Blocked Readers</CardTitle>
          <CardDescription className="font-sans">
            Blocked readers cannot see your posts, profile, media, or activity, and you cannot see theirs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasLoaded ? (
            <div aria-hidden="true" className="flex items-center gap-3 rounded-md border border-border/70 p-3"><Skeleton className="h-9 w-9 shrink-0 rounded-full" /><div className="min-w-0 flex-1"><Skeleton className="h-5 w-28" /><Skeleton className="mt-1 h-4 w-20" /></div><Skeleton className="h-10 min-h-11 w-20" /></div>
          ) : blockedUsers.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/70 p-4 text-center">
              <p className="font-sans text-sm text-muted-foreground">
                You have not blocked anyone.
              </p>
            </div>
          ) : (
            blockedUsers.map((blocked) => (
              <div
                key={blocked.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/70 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={blocked.user?.avatar_url || undefined} />
                    <AvatarFallback>{initials(blocked.user?.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-sans text-sm font-medium">
                      {blocked.user?.display_name || "Blocked reader"}
                    </p>
                    <p className="font-sans text-xs text-muted-foreground">
                      Blocked {new Date(blocked.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" aria-label={`Unblock ${blocked.user?.display_name || "reader"}`} onClick={() => handleUnblock(blocked.user_id)}>
                  Unblock
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      </fieldset>}
    </LoadingRegion>
  );
};

export const PrivacySettings = ({ user }: PrivacySettingsProps) => <PrivacySettingsContent key={user.id} user={user} />;

const READER_STATUS_OPTIONS: Array<{ value: ReaderStatusBadge; label: string }> = [
  { value: "available", label: "Available" },
  { value: "reading_now", label: "Reading now" },
  { value: "buddy_reads", label: "Open to buddy reads" },
  { value: "looking_for_club", label: "Looking for a club" },
  { value: "taking_recommendations", label: "Taking recommendations" },
  { value: "quiet", label: "Quiet" },
];
