import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock, Mail, Calendar, Shield } from "iconoir-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { User, Profile } from "@/types";

interface AccountSettingsProps {
  user: User;
}

export const AccountSettings = ({ user }: AccountSettingsProps) => {
  const { toast } = useToast();
  const [email, setEmail] = useState(user?.email || "");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (data) setProfile(data);
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Password reset email sent",
        description: "Check your email for instructions to reset your password.",
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send password reset email",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Account Settings</h2>
        <p className="font-sans text-muted-foreground mt-1">
          Manage your account information and security
        </p>
      </div>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Address
          </CardTitle>
          <CardDescription className="font-sans">
            Your email address cannot be changed. Contact support if you need to update it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={email}
              disabled
              className="bg-muted"
            />
          </div>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription className="font-sans">
            Change your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handlePasswordReset}
            disabled={loading}
            variant="outline"
          >
            {loading ? "Sending..." : "Send Password Reset Email"}
          </Button>
        </CardContent>
      </Card>

      {/* Account Created */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Account Created</Label>
            <Input
              value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Unknown"}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label>User ID</Label>
            <Input
              value={user.id}
              disabled
              className="bg-muted font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Subscription (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Subscription
          </CardTitle>
          <CardDescription>
            Manage your subscription and billing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Free Plan - Upgrade coming soon
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
