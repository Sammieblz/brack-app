import { getApiErrorStatus } from "@/services/api/client";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";
import { ProfileSkeleton } from "@/components/skeletons/ProfileSkeleton";
import { useState, useEffect, useId, useRef, useCallback } from "react";
import { useSettingsLeave, useSettingsTask } from "@/contexts/SettingsTaskContext";
import type { PickedImage } from "@/hooks/useImagePicker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { useFollowing } from "@/hooks/useFollowing";
import { useNavigate } from "react-router-dom";
import { getInitials } from "@/lib/avatarUtils";
import { APP_ICONS } from "@/config/iconography";
import { AppIcon } from "@/components/ui/app-icon";
import type { User as UserType, Profile } from "@/types";
import {
  fetchProfile,
  removeStorageFiles,
  updateProfileAvatar,
  uploadPublicStorageFile,
  upsertProfileBasics,
} from "@/services/api";

interface ProfileSettingsProps {
  user: UserType;
}

const ProfileSettingsContent = ({ user }: ProfileSettingsProps) => {
  const id = useId();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { followersCount, followingCount } = useFollowing(user?.id || null);
  const [profile, setProfile] = useState<Pick<Profile, "avatar_url" | "display_name" | "bio"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const readRequest = useRef(0);
  const photoTriggerRef = useRef<HTMLButtonElement>(null);
  const photoTaskRef = useRef<HTMLDivElement>(null);
  const uploadedPhoto = useRef<{ image: PickedImage; url: string } | null>(null);
  const leave = useSettingsLeave();
  
  const [formData, setFormData] = useState({
    display_name: "",
    bio: "",
  });
  const [baseline, setBaseline] = useState(formData);
  const busy = saving || uploading;
  useSettingsTask({ dirty: JSON.stringify(formData) !== JSON.stringify(baseline) || Boolean(photo), pending: busy });

  const loadProfile = useCallback(async () => {
    const request = ++readRequest.current;
    
    try {
      setLoading(true);
      setLoadError(null);
      const data = await fetchProfile(user.id);
      if (!mounted.current || readRequest.current !== request) return;
      setHasLoaded(true);
      if (data) {
        setProfile(data);
        const draft = {
          display_name: data.display_name || "",
          bio: data.bio || "",
        };
        setFormData(draft);
        setBaseline(draft);
      }
    } catch (error) {
      if (!mounted.current || readRequest.current !== request) return;
      if ([401, 403, 404].includes(getApiErrorStatus(error) ?? 0)) { setHasLoaded(false); setProfile(null); }
      console.error('Error loading profile:', error);
      setLoadError("We couldn't load your profile. Please try again.");
    } finally {
      if (mounted.current && readRequest.current === request) setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    mounted.current = true;
    void loadProfile();
    return () => { mounted.current = false; readRequest.current += 1; };
  }, [loadProfile]);

  const handleSave = async () => {
    if (!mounted.current || pending.current) return;
    pending.current = true;
    const submitted = { ...formData };
    setSaving(true);
    setSaveError(null);
    try {
      await upsertProfileBasics(user.id, {
        display_name: submitted.display_name || null,
        bio: submitted.bio || null,
      });
      if (!mounted.current) return;
      setBaseline(submitted);
      setProfile((previous) => ({ avatar_url: previous?.avatar_url ?? null, ...submitted }));

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      
    } catch (error: unknown) {
      if (!mounted.current) return;
      setSaveError(error instanceof Error ? error.message : "Failed to update profile");
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
      });
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const cleanOldAvatar = (url: string | null | undefined) => {
    if (!url) return;
    const oldPath = url.split('/').slice(-2).join('/');
    void removeStorageFiles("avatars", [oldPath]).catch((error) => console.error("Old avatar cleanup failed:", error));
  };

  const uploadAvatarToStorage = async (imageData: PickedImage) => {
    if (!mounted.current || pending.current) return;
    pending.current = true;
    setPhoto(imageData);
    setPhotoError(null);
    setUploading(true);
    const oldAvatar = profile?.avatar_url;
    try {
      if (!imageData.base64) throw new Error("Could not read this photo. Choose another image.");
      const byteCharacters = atob(imageData.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${imageData.format}` });

      const fileName = `${Date.now()}-avatar.${imageData.format}`;
      const filePath = `${user.id}/${fileName}`;

      const publicUrl = uploadedPhoto.current?.image === imageData ? uploadedPhoto.current.url : await uploadPublicStorageFile(
        "avatars",
        filePath,
        blob,
        { contentType: `image/${imageData.format}` }
      );
      if (!mounted.current) return;
      uploadedPhoto.current = { image: imageData, url: publicUrl };
      await updateProfileAvatar(user.id, publicUrl);
      if (!mounted.current) return;
      setProfile((previous) => ({ display_name: previous?.display_name ?? null, bio: previous?.bio ?? null, avatar_url: publicUrl }));
      setPhoto(null);
      uploadedPhoto.current = null;
      cleanOldAvatar(oldAvatar);
      toast({
        title: "Success",
        description: "Profile photo updated successfully",
      });

    } catch (error: unknown) {
      if (!mounted.current) return;
      setPhotoError(error instanceof Error ? error.message : "Failed to upload profile photo");
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload profile photo",
      });
    } finally {
      pending.current = false;
      if (mounted.current) setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!mounted.current || pending.current || !profile?.avatar_url) return;
    pending.current = true;
    setUploading(true);
    setPhotoError(null);
    const oldAvatar = profile.avatar_url;
    try {
      await updateProfileAvatar(user.id, null);
      if (!mounted.current) return;
      setProfile((previous) => previous ? { ...previous, avatar_url: null } : previous);
      setPhoto(null);
      uploadedPhoto.current = null;
      cleanOldAvatar(oldAvatar);
      toast({ title: "Success", description: "Profile photo removed successfully" });
    } catch (error) {
      if (mounted.current) setPhotoError(error instanceof Error ? error.message : "Failed to remove profile photo");
    } finally {
      pending.current = false;
      if (mounted.current) setUploading(false);
    }
  };

  const handleImagePicked = async (image: { dataUrl: string; format: string; base64?: string }) => {
    await uploadAvatarToStorage(image);
  };

  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  if (!hasLoaded) {
    return <LoadingRegion loading={loading} label="Loading profile settings">{loadError && <LoadingError message={loadError} onRetry={loadProfile} />}{loading && <ProfileSkeleton />}</LoadingRegion>;
  }

  return (
    <LoadingRegion loading={false} refreshing={loading} label="Loading profile settings" className="space-y-6">
      {loadError && <LoadingError message={loadError} onRetry={loadProfile} />}
      <fieldset disabled={busy} className="min-w-0 space-y-6">
      <legend className="sr-only">Profile settings</legend>
      {/* Social Profile View */}
      <Card>
        <CardHeader>
          <CardTitle>Social Profile</CardTitle>
          <CardDescription>
            How others see your profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={photo?.dataUrl || profile?.avatar_url} />
              <AvatarFallback className="text-lg">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-sans font-semibold text-lg truncate">{displayName}</h3>
              {profile?.bio && (
                <p className="font-sans text-sm text-muted-foreground line-clamp-2 mt-1">{profile.bio}</p>
              )}
            </div>
          </div>
          
          <div className="flex gap-6 pt-4 border-t">
            <div className="flex flex-col items-start">
              <span className="font-sans text-2xl font-bold">{followersCount}</span>
              <span className="font-sans text-sm text-muted-foreground">Followers</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="font-sans text-2xl font-bold">{followingCount}</span>
              <span className="font-sans text-sm text-muted-foreground">Following</span>
            </div>
            <button
              onClick={() => void leave(() => navigate("/users/me"))}
              className="flex flex-col items-start hover:opacity-80 transition-opacity ml-auto"
            >
              <span className="font-sans text-sm text-primary font-medium">View Profile</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Avatar */}
      <Card ref={photoTaskRef} role="group" tabIndex={-1} aria-labelledby={`${id}-photo-title`}
        aria-describedby={busy ? `${id}-save-status` : photoError ? `${id}-photo-error` : undefined}>
        <CardHeader>
          <CardTitle id={`${id}-photo-title`} className="font-display">Profile Picture</CardTitle>
          <CardDescription className="font-sans">
            Update your profile picture to personalize your account
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center gap-4">
          <Avatar className="h-20 w-20 shrink-0">
            <AvatarImage src={photo?.dataUrl || profile?.avatar_url} />
            <AvatarFallback className="text-lg">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 w-full space-y-2">
            <p className="font-sans text-sm text-muted-foreground text-center sm:text-left">
              Update your profile picture to personalize your account
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                ref={photoTriggerRef}
                variant="outline"
                disabled={busy}
                aria-describedby={photoError ? `${id}-photo-error` : undefined}
                onClick={() => setShowImagePicker(true)}
                className="w-full sm:w-auto"
              >
                <AppIcon icon={APP_ICONS.common.camera} variant="inline" size="sm" className="mr-2" />
                {uploading ? "Uploading..." : "Choose Photo"}
              </Button>
              {profile?.avatar_url && (
                <Button
                  variant="outline"
                  disabled={busy}
                  aria-label="Remove profile photo"
                  aria-describedby={photoError ? `${id}-photo-error` : undefined}
                  onClick={() => void removeAvatar()}
                  className="w-full sm:w-auto"
                >
                  Remove
                </Button>
              )}
            </div>
            {photoError && <p id={`${id}-photo-error`} role="alert" className="text-sm text-destructive">{photoError}</p>}
            {photo && !uploading && <><p className="text-sm text-muted-foreground">This selected photo has not been saved. Retry or discard it.</p><div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void uploadAvatarToStorage(photo)} aria-describedby={photoError ? `${id}-photo-error` : undefined}>Retry photo upload</Button>
              <Button type="button" variant="outline" onClick={() => { uploadedPhoto.current = null; setPhoto(null); setPhotoError(null); }}>Discard selected photo</Button>
            </div></>}
          </div>
          <ImagePickerDialog
            returnFocusRef={busy ? photoTaskRef : photoTriggerRef}
            open={showImagePicker}
            onOpenChange={(next) => { if (mounted.current) setShowImagePicker(next); }}
            onImagePicked={handleImagePicked}
            title="Choose Profile Photo"
            description="Take a photo or select from your library"
          />
        </CardContent>
      </Card>

      {/* Display Name */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Display Name</CardTitle>
          <CardDescription id={`${id}-name-help`} className="font-sans">
            This is how your name appears to other users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor={`${id}-display-name`}>Display Name</Label>
            <Input
              id={`${id}-display-name`} aria-describedby={`${id}-name-help`}
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              placeholder="How you'd like to be addressed"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Bio</CardTitle>
          <CardDescription id={`${id}-bio-help`} className="font-sans">
            Tell others about yourself and your reading interests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor={`${id}-bio`}>Bio</Label>
            <Textarea
              id={`${id}-bio`} aria-describedby={`${id}-bio-help`}
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Tell us a bit about yourself and your reading interests..."
              rows={4}
              className="font-sans"
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {saveError && <p id={`${id}-save-error`} role="alert" className="text-sm text-destructive">{saveError}</p>}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} aria-describedby={saveError ? `${id}-save-error` : undefined}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
      </fieldset>
      {busy && <p id={`${id}-save-status`} role="status" className="text-sm text-muted-foreground">{uploading ? "Updating your profile photo…" : "Saving your profile…"}</p>}
    </LoadingRegion>
  );
};

export const ProfileSettings = ({ user }: ProfileSettingsProps) => <ProfileSettingsContent key={user.id} user={user} />;
