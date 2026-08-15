import { useCallback, useEffect, useState } from "react";
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

export const PrivacySettings = ({ user }: PrivacySettingsProps) => {
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

  const loadPrivacy = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: profile, error }, blocks] = await Promise.all([
        supabase
          .from("profiles")
          .select("profile_visibility, show_reading_activity, show_online_status, reader_status, show_location, latitude, longitude, leaderboard_opt_in, gamification_profile_visible")
          .eq("id", user.id)
          .maybeSingle(),
        getBlockedUsers(),
      ]);
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
    } catch (error) {
      console.error("Failed to load privacy settings", error);
      toast.error("Failed to load privacy settings");
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadPrivacy();
  }, [loadPrivacy]);

  const updateProfilePrivacy = async (updates: Record<string, unknown>) => {
    const { error } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) throw error;
  };

  const togglePublicProfile = async (checked: boolean) => {
    const previous = publicProfile;
    setPublicProfile(checked);
    try {
      await updateProfilePrivacy({ profile_visibility: checked ? "public" : "private" });
    } catch (error) {
      setPublicProfile(previous);
      toast.error("Failed to update profile visibility");
    }
  };

  const toggleReadingActivity = async (checked: boolean) => {
    const previous = showReadingActivity;
    setShowReadingActivity(checked);
    try {
      await updateProfilePrivacy({ show_reading_activity: checked });
      toast.success(checked ? "Activity sharing enabled" : "Activity sharing disabled");
    } catch (error) {
      setShowReadingActivity(previous);
      toast.error("Failed to update activity privacy");
    }
  };

  const toggleOnlineStatus = async (checked: boolean) => {
    const previous = showOnlineStatus;
    setShowOnlineStatus(checked);
    try {
      await updateProfilePrivacy({
        show_online_status: checked,
        last_seen_at: checked ? new Date().toISOString() : null,
      });
      if (checked) {
        await updatePresence();
      }
      toast.success(checked ? "Online status enabled" : "Online status hidden");
    } catch (error) {
      setShowOnlineStatus(previous);
      toast.error("Failed to update online status");
    }
  };

  const updateReaderStatus = async (value: ReaderStatusBadge) => {
    const previous = readerStatus;
    setReaderStatus(value);
    try {
      await updatePresence(value);
      toast.success("Reader status updated");
    } catch (error) {
      setReaderStatus(previous);
      toast.error("Failed to update reader status");
    }
  };

  const toggleLocation = async (checked: boolean) => {
    const previous = showLocation;
    setShowLocation(checked);
    try {
      await updateProfilePrivacy({ show_location: checked });
      if (checked && !hasSavedLocation) {
        toast.info("Add your city or current location from Personal Info to appear nearby.");
      } else {
        toast.success(checked ? "Nearby discovery enabled" : "Nearby discovery hidden");
      }
    } catch (error) {
      setShowLocation(previous);
      toast.error("Failed to update location privacy");
    }
  };

  const toggleLeaderboard = async (checked: boolean) => {
    const previous = leaderboardOptIn;
    setLeaderboardOptIn(checked);
    try {
      const response = await updateGamificationSettings({ leaderboard_opt_in: checked });
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
    } catch {
      setLeaderboardOptIn(previous);
      toast.error("Failed to update Reader League participation");
    }
  };

  const toggleGamificationVisibility = async (checked: boolean) => {
    const previous = gamificationProfileVisible;
    setGamificationProfileVisible(checked);
    try {
      await updateGamificationSettings({ gamification_profile_visible: checked });
      void invalidateDashboardHomeQueries(queryClient, user.id);
      toast.success(checked ? "Journey details are visible" : "Journey details are private");
    } catch {
      setGamificationProfileVisible(previous);
      toast.error("Failed to update Journey visibility");
    }
  };

  const handleUnblock = async (userId: string) => {
    const previous = blockedUsers;
    setBlockedUsers((current) => current.filter((blocked) => blocked.user_id !== userId));
    try {
      await unblockUser(userId);
      toast.success("Reader unblocked");
    } catch (error) {
      setBlockedUsers(previous);
      toast.error("Failed to unblock reader");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Privacy Settings</h2>
        <p className="font-sans text-muted-foreground mt-1">
          Control who can see you, your activity, and your social interactions.
        </p>
      </div>

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
              <Label>Public Profile</Label>
              <p className="font-sans text-sm text-muted-foreground">
                Allow readers to find and view your profile.
              </p>
            </div>
            <Switch
              checked={publicProfile}
              disabled={loading}
              onCheckedChange={togglePublicProfile}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Show Reading Activity</Label>
              <p className="font-sans text-sm text-muted-foreground">
                Include your reading updates in mutual-friend Activity feeds.
              </p>
            </div>
            <Switch
              checked={showReadingActivity}
              disabled={loading}
              onCheckedChange={toggleReadingActivity}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Show Location</Label>
              <p className="font-sans text-sm text-muted-foreground">
                Allow your saved location to be used for nearby reader discovery.
              </p>
              {!hasSavedLocation && showLocation && (
                <p className="font-sans text-xs text-muted-foreground">
                  No saved coordinates yet. Add them from Personal Info.
                </p>
              )}
            </div>
            <Switch checked={showLocation} disabled={loading} onCheckedChange={toggleLocation} />
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
              <Label>Join Reader Leagues</Label>
              <p className="font-sans text-sm text-muted-foreground">
                Enter optional weekly leagues using qualifying reading activity. New opt-ins start next week.
              </p>
            </div>
            <Switch
              checked={leaderboardOptIn}
              disabled={loading}
              onCheckedChange={toggleLeaderboard}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Show Journey on Profile</Label>
              <p className="font-sans text-sm text-muted-foreground">
                Let eligible readers see your level and league rank.
              </p>
            </div>
            <Switch
              checked={gamificationProfileVisible}
              disabled={loading}
              onCheckedChange={toggleGamificationVisibility}
            />
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
              <Label>Show Online Status</Label>
              <p className="font-sans text-sm text-muted-foreground">
                Let mutual friends see when you are active in Brack.
              </p>
            </div>
            <Switch
              checked={showOnlineStatus}
              disabled={loading}
              onCheckedChange={toggleOnlineStatus}
            />
          </div>

          <div className="grid gap-2">
            <Label>Reader Status Badge</Label>
            <Select
              value={readerStatus}
              onValueChange={(value) => updateReaderStatus(value as ReaderStatusBadge)}
              disabled={loading}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Choose a reader status" />
              </SelectTrigger>
              <SelectContent>
                {READER_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          {blockedUsers.length === 0 ? (
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
                <Button variant="outline" size="sm" onClick={() => handleUnblock(blocked.user_id)}>
                  Unblock
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const READER_STATUS_OPTIONS: Array<{ value: ReaderStatusBadge; label: string }> = [
  { value: "available", label: "Available" },
  { value: "reading_now", label: "Reading now" },
  { value: "buddy_reads", label: "Open to buddy reads" },
  { value: "looking_for_club", label: "Looking for a club" },
  { value: "taking_recommendations", label: "Taking recommendations" },
  { value: "quiet", label: "Quiet" },
];
