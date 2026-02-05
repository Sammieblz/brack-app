import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBadges } from "@/hooks/useBadges";
import { useStreaks } from "@/hooks/useStreaks";
import { Save, User, Upload, Palette, Award, Flame, MapPin, Target, BarChart3, BookMarked, ArrowRight, Share2, Bell, BellOff, Camera } from "lucide-react";
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { useImagePicker } from "@/hooks/useImagePicker";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Switch } from "@/components/ui/switch";
import { shareService } from "@/services/shareService";
import { useBooks } from "@/hooks/useBooks";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ThemeSelector } from "@/components/ThemeSelector";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { StreakDisplay } from "@/components/StreakDisplay";
import { StreakCalendar } from "@/components/StreakCalendar";
import { StreakHistoryTimeline } from "@/components/StreakHistoryTimeline";
import { ReadingHabitsSection } from "@/components/ReadingHabitsSection";
import { QuoteCollection } from "@/components/QuoteCollection";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import type { Profile } from "@/types";

const ProfilePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { badges, earnedBadges, loading: badgesLoading } = useBadges(user?.id);
  const { streakData, activityCalendar, loading: streaksLoading, useStreakFreeze } = useStreaks(user?.id);
  const { books } = useBooks(user?.id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const { isRegistered, register, unregister, error: pushError } = usePushNotifications();
  const { pickWithPrompt } = useImagePicker();
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
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    display_name: "",
    bio: "",
    phone_number: "",
    date_of_birth: "",
    city: "",
    country: "",
    latitude: "",
    longitude: "",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (user) {
      loadProfile();
      loadNotificationPreferences();
    }
  }, [user, authLoading, navigate]);

  // Cleanup object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const loadNotificationPreferences = async () => {
    if (!user) return;
    
    try {
      setLoadingPrefs(true);
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
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

      // Register/unregister push notifications based on preference
      if (notificationPrefs.push_enabled && !isRegistered) {
        await register();
      } else if (!notificationPrefs.push_enabled && isRegistered) {
        await unregister();
      }
    } catch (error: unknown) {
      console.error("Error saving notification preferences:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save notification preferences",
      });
    }
  };

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data) {
        setProfile(data);
        setFormData({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          display_name: data.display_name || "",
          bio: data.bio || "",
          phone_number: data.phone_number || "",
          date_of_birth: data.date_of_birth || "",
          city: data.city || "",
          country: data.country || "",
          latitude: data.latitude?.toString() || "",
          longitude: data.longitude?.toString() || "",
        });
      }
    } catch (error: unknown) {
      console.error('Error loading profile:', error);
      toast({
        variant: "destructive",
        title: "Error loading profile",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const uploadAvatarToStorage = async (imageData: { dataUrl: string; format: string; base64?: string }) => {
    if (!user || !imageData.base64) return;

    setUploading(true);
    try {
      // Convert base64 to blob
      const byteCharacters = atob(imageData.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${imageData.format}` });

      // Set preview
      setPreviewUrl(imageData.dataUrl);

      // Delete old avatar if exists
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from("avatars").remove([oldPath]);
      }

      // Upload new avatar
      const fileName = `${Date.now()}-avatar.${imageData.format}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, {
          contentType: `image/${imageData.format}`,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Profile photo updated successfully",
      });

      loadProfile();
    } catch (error: unknown) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload profile photo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleImagePicked = async (image: { dataUrl: string; format: string; base64?: string }) => {
    await uploadAvatarToStorage(image);
  };

  const handleRemoveAvatar = async () => {
    if (!user || !profile?.avatar_url) return;

    setUploading(true);
    try {
      // Delete from storage
      const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
      await supabase.storage.from("avatars").remove([oldPath]);

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

      if (error) throw error;

      setPreviewUrl(null);
      toast({
        title: "Success",
        description: "Profile photo removed successfully",
      });

      loadProfile();
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast({
        title: "Error",
        description: "Failed to remove profile photo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Geolocation not supported",
        description: "Your browser doesn't support geolocation",
      });
      return;
    }

    toast({
      title: "Getting location...",
      description: "Please allow location access in your browser",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        toast({
          title: "Location retrieved",
          description: "Your coordinates have been updated",
        });
      },
      (error) => {
        toast({
          variant: "destructive",
          title: "Location error",
          description: error instanceof Error ? error.message : "An error occurred",
        });
      }
    );
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const updateData = {
        ...formData,
        display_name: formData.display_name || `${formData.first_name} ${formData.last_name}`.trim(),
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        city: formData.city || null,
        country: formData.country || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...updateData,
        });

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      
      loadProfile(); // Reload profile data
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      toast({
        variant: "destructive",
        title: "Error updating profile",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading profile..." />
      </div>
    );
  }

  const displayName = profile?.display_name || 
                     user?.user_metadata?.full_name || 
                     `${formData.first_name} ${formData.last_name}`.trim() ||
                     user?.email?.split('@')[0] || 
                     'User';

  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <MobileLayout>
      <MobileHeader title="Profile Settings" showBack />
      <div className="container max-w-2xl mx-auto p-4 space-y-6">

        {/* Quick Access Navigation Cards */}
        <div className="grid grid-cols-3 gap-3 animate-fade-in">
          <Card 
            className="cursor-pointer hover:bg-accent transition-all active:scale-95 touch-manipulation"
            onClick={() => {
              navigate('/goals');
            }}
          >
            <CardContent className="p-3 sm:p-4 flex flex-col items-center gap-2 text-center">
              <div className="p-2 rounded-full bg-primary/10">
                <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <span className="text-xs font-medium">Goals</span>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent transition-all active:scale-95 touch-manipulation"
            onClick={() => {
              navigate('/analytics');
            }}
          >
            <CardContent className="p-3 sm:p-4 flex flex-col items-center gap-2 text-center">
              <div className="p-2 rounded-full bg-primary/10">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <span className="text-xs font-medium">Analytics</span>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent transition-all active:scale-95 touch-manipulation"
            onClick={() => {
              navigate('/book-lists');
            }}
          >
            <CardContent className="p-3 sm:p-4 flex flex-col items-center gap-2 text-center">
              <div className="p-2 rounded-full bg-primary/10">
                <BookMarked className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <span className="text-xs font-medium">Lists</span>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent transition-all active:scale-95 touch-manipulation"
            onClick={() => {
              navigate('/history');
            }}
          >
            <CardContent className="p-3 sm:p-4 flex flex-col items-center gap-2 text-center">
              <div className="p-2 rounded-full bg-primary/10">
                <BookMarked className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <span className="text-xs font-medium">History</span>
            </CardContent>
          </Card>
        </div>

        {/* Profile Avatar Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Profile Picture
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <Avatar className="h-20 w-20 shrink-0">
              <AvatarImage src={previewUrl || profile?.avatar_url || (user?.user_metadata as { avatar_url?: string } | undefined)?.avatar_url} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 w-full">
              <p className="text-sm text-muted-foreground mb-3 text-center sm:text-left">
                Update your profile picture to personalize your account
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  disabled={uploading}
                  onClick={() => setShowImagePicker(true)}
                  className="w-full sm:w-auto"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Choose Photo"}
                </Button>
                {profile?.avatar_url && (
                  <Button 
                    variant="outline" 
                    disabled={uploading}
                    onClick={handleRemoveAvatar}
                    className="w-full sm:w-auto"
                  >
                    Remove
                  </Button>
                )}
              </div>
              <ImagePickerDialog
                open={showImagePicker}
                onOpenChange={setShowImagePicker}
                onImagePicked={handleImagePicked}
                title="Choose Profile Photo"
                description="Take a photo or select from your library"
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Palette className="h-5 w-5 mr-2" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm font-medium mb-2 block">Theme Mode</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Choose between light mode, dark mode, or follow your system preference.
              </p>
              <DarkModeToggle />
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Color Palette</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Choose your preferred color palette. Changes are applied instantly.
              </p>
              <ThemeSelector />
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="Enter your first name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="Enter your last name"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => handleInputChange('display_name', e.target.value)}
                placeholder="How you'd like to be addressed"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                type="tel"
                value={formData.phone_number}
                onChange={(e) => handleInputChange('phone_number', e.target.value)}
                placeholder="Enter your phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Tell us a bit about yourself and your reading interests..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Location Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Location Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add your location to discover readers near you and connect with your local reading community.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="e.g., New York"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  placeholder="e.g., United States"
                  maxLength={100}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => handleInputChange('latitude', e.target.value)}
                  placeholder="e.g., 40.7128"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => handleInputChange('longitude', e.target.value)}
                  placeholder="e.g., -74.0060"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleGetCurrentLocation}
                className="flex items-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                Use Current Location
              </Button>
              <p className="text-xs text-muted-foreground">
                Click to automatically detect your coordinates
              </p>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Privacy Note:</strong> Your location data is used only for reader discovery features. 
                You can change your profile visibility settings to control who can see your location.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Notification Preferences
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
                      <p className="text-sm text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quiet_hours_start">Quiet Hours Start</Label>
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
                      <Label htmlFor="quiet_hours_end">Quiet Hours End</Label>
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
                  <p className="text-xs text-muted-foreground mt-2">
                    Notifications will be silenced during these hours
                  </p>
                </div>

                {pushError && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
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

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact support if you need to update your email.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Account Created</Label>
              <Input
                value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Unknown"}
                disabled
                className="bg-muted"
              />
            </div>
          </CardContent>
        </Card>

        {/* Reading Streak Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Flame className="h-5 w-5 mr-2 text-orange-500" />
                Reading Streak
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={async () => {
                  try {
                    // Calculate total reading hours from sessions
                    const { data: sessions } = await supabase
                      .from('reading_sessions')
                      .select('duration')
                      .eq('user_id', user?.id);
                    
                    const totalMinutes = sessions?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0;
                    const totalHours = Math.round(totalMinutes / 60);
                    const completedBooks = books.filter(b => b.status === 'completed').length;

                    await shareService.shareReadingStats({
                      booksCompleted: completedBooks,
                      totalHours,
                      currentStreak: streakData.currentStreak,
                      username: profile?.display_name || undefined,
                    });
                  } catch (error: unknown) {
                    if (error instanceof Error && !error.message?.includes('cancelled')) {
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to share reading stats",
                      });
                    }
                  }
                }}
                title="Share reading stats"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StreakDisplay 
                streakData={streakData}
                onUseFreeze={useStreakFreeze}
              />
              <StreakCalendar activityCalendar={activityCalendar} />
            </div>
          </CardContent>
        </Card>

        {/* Reading Habits Section */}
        {user && <ReadingHabitsSection userId={user.id} />}

        {/* Streak History Section */}
        {user && <StreakHistoryTimeline userId={user.id} />}

        {/* Quote Collection Section */}
        {user && <QuoteCollection userId={user.id} />}

        {/* Badges Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="h-5 w-5 mr-2" />
              Achievements & Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            {badgesLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            ) : badges.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  You've earned {earnedBadges.length} out of {badges.length} badges
                </p>
                <BadgeDisplay badges={badges} earnedBadges={earnedBadges} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No badges available yet</p>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
};

export default ProfilePage;
