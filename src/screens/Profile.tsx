import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Save, User, Camera, Users } from "lucide-react";
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { useImagePicker } from "@/hooks/useImagePicker";
import LoadingSpinner from "@/components/LoadingSpinner";
import { MobileLayout } from "@/components/MobileLayout";
import { MobileHeader } from "@/components/MobileHeader";
import { useFollowing } from "@/hooks/useFollowing";
import { getInitials } from "@/lib/avatarUtils";
import type { Profile } from "@/types";

const ProfilePage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { pickWithPrompt } = useImagePicker();
  const { followersCount, followingCount } = useFollowing(user?.id || null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);

  const [formData, setFormData] = useState({
    display_name: "",
    bio: "",
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

  // Cleanup object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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
          display_name: data.display_name || "",
          bio: data.bio || "",
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatarToStorage = async (imageData: { dataUrl: string; format: string; base64?: string }) => {
    if (!user || !imageData.base64) return;

    setUploading(true);
    try {
      const byteCharacters = atob(imageData.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: `image/${imageData.format}` });

      setPreviewUrl(imageData.dataUrl);

      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from("avatars").remove([oldPath]);
      }

      const fileName = `${Date.now()}-avatar.${imageData.format}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, blob, {
          contentType: `image/${imageData.format}`,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

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

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          display_name: formData.display_name || null,
          bio: formData.bio || null,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      
      loadProfile();
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
                     user?.email?.split('@')[0] || 
                     'User';

  return (
    <MobileLayout>
      <MobileHeader title="Profile Settings" showBack />
      <div className="container max-w-2xl mx-auto p-4 space-y-6">

        {/* Social Profile View */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Social Profile
            </CardTitle>
            <CardDescription>
              How others see your profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={previewUrl || profile?.avatar_url} />
                <AvatarFallback className="text-lg">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-sans font-semibold text-lg truncate">{displayName}</h3>
                {profile?.bio && (
                  <p className="font-serif text-sm text-muted-foreground line-clamp-2 mt-1">{profile.bio}</p>
                )}
              </div>
            </div>
            
            <div className="flex gap-6 pt-4 border-t">
              <button
                onClick={() => navigate(`/users/${user?.id}/followers`)}
                className="flex flex-col items-start hover:opacity-80 transition-opacity"
              >
                <span className="font-sans text-2xl font-bold">{followersCount}</span>
                <span className="font-sans text-sm text-muted-foreground">Followers</span>
              </button>
              <button
                onClick={() => navigate(`/users/${user?.id}/following`)}
                className="flex flex-col items-start hover:opacity-80 transition-opacity"
              >
                <span className="font-sans text-2xl font-bold">{followingCount}</span>
                <span className="font-sans text-sm text-muted-foreground">Following</span>
              </button>
              <button
                onClick={() => navigate(`/users/${user?.id}`)}
                className="flex flex-col items-start hover:opacity-80 transition-opacity ml-auto"
              >
                <span className="text-sm text-primary font-medium">View Profile</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Profile Picture */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Picture
            </CardTitle>
            <CardDescription>
              Update your profile picture to personalize your account
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-4">
            <Avatar className="h-20 w-20 shrink-0">
              <AvatarImage src={previewUrl || profile?.avatar_url} />
              <AvatarFallback className="text-lg">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 w-full space-y-2">
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
                    onClick={async () => {
                      if (!user || !profile?.avatar_url) return;
                      setUploading(true);
                      try {
                        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
                        await supabase.storage.from("avatars").remove([oldPath]);
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
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: "Failed to remove profile photo",
                        });
                      } finally {
                        setUploading(false);
                      }
                    }}
                    className="w-full sm:w-auto"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <ImagePickerDialog
              open={showImagePicker}
              onOpenChange={setShowImagePicker}
              onImagePicked={handleImagePicked}
              title="Choose Profile Photo"
              description="Take a photo or select from your library"
            />
          </CardContent>
        </Card>

        {/* Display Name */}
        <Card>
          <CardHeader>
            <CardTitle>Display Name</CardTitle>
            <CardDescription>
              This is how your name appears to other users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
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
            <CardTitle>Bio</CardTitle>
            <CardDescription>
              Tell others about yourself and your reading interests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Tell us a bit about yourself and your reading interests..."
                rows={4}
              />
            </div>
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
