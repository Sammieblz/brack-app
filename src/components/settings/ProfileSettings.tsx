import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImagePickerDialog } from "@/components/ImagePickerDialog";
import { useImagePicker } from "@/hooks/useImagePicker";
import type { User as UserType, Profile } from "@/types";

interface ProfileSettingsProps {
  user: UserType;
}

export const ProfileSettings = ({ user }: ProfileSettingsProps) => {
  const { toast } = useToast();
  const { pickWithPrompt } = useImagePicker();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    display_name: "",
    bio: "",
  });

  useEffect(() => {
    loadProfile();
  }, [user]);

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
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
      });
    } finally {
      setSaving(false);
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
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload profile photo",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleImagePicked = async (image: { dataUrl: string; format: string; base64?: string }) => {
    await uploadAvatarToStorage(image);
  };

  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Profile Settings</h2>
        <p className="text-muted-foreground mt-1">
          Customize how others see your profile
        </p>
      </div>

      {/* Avatar */}
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
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 w-full">
            <Button
              variant="outline"
              disabled={uploading}
              onClick={() => setShowImagePicker(true)}
              className="w-full sm:w-auto"
            >
              <Camera className="h-4 w-4 mr-2" />
              {uploading ? "Uploading..." : "Choose Photo"}
            </Button>
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
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};
