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
import { Save, User, Upload, Palette, Award, Flame, MapPin, Target, BarChart3, BookMarked, ArrowRight } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ThemeSelector } from "@/components/ThemeSelector";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { StreakDisplay } from "@/components/StreakDisplay";
import { StreakCalendar } from "@/components/StreakCalendar";
import { ReadingHabitsSection } from "@/components/ReadingHabitsSection";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import type { Profile } from "@/types";

const ProfilePage = () => {
  const { user, loading: authLoading } = useAuth();
  const { badges, earnedBadges, loading: badgesLoading } = useBadges(user?.id);
  const { streakData, activityCalendar, loading: streaksLoading, useStreakFreeze } = useStreaks(user?.id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
    }
  }, [user, authLoading, navigate]);

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
    } catch (error: any) {
      console.error('Error loading profile:', error);
      toast({
        variant: "destructive",
        title: "Error loading profile",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, or WEBP image",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Create preview
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);

      // Delete old avatar if exists
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from("avatars").remove([oldPath]);
      }

      // Upload new avatar
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-avatar.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

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
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Error",
        description: "Failed to upload profile photo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
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
          description: error.message,
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
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        variant: "destructive",
        title: "Error updating profile",
        description: error.message,
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
              <AvatarImage src={previewUrl || profile?.avatar_url || (user?.user_metadata as any)?.avatar_url} />
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
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                  className="w-full sm:w-auto"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Upload Photo"}
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
              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileUpload}
                className="hidden"
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
            <CardTitle className="flex items-center">
              <Flame className="h-5 w-5 mr-2 text-orange-500" />
              Reading Streak
            </CardTitle>
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