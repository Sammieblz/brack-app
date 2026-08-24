import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fetchProfile, sendPasswordResetEmail, updatePassword } from "@/services/api";
import { getPasswordResetRedirectUrl } from "@/services/platform";
import { useToast } from "@/hooks/use-toast";
import { validatePassword } from "@/utils/authValidation";
import type { User, Profile } from "@/types";

interface AccountSettingsProps {
  user: User;
}

const getIdentityProviders = (user: User): Set<string> => {
  const providers = new Set<string>();

  user.identities?.forEach((identity) => {
    if (identity.provider) providers.add(identity.provider);
  });

  if (user.app_metadata?.provider) {
    providers.add(user.app_metadata.provider);
  }

  user.app_metadata?.providers?.forEach((provider) => providers.add(provider));

  return providers;
};

const isGoogleOnlyAccount = (user: User): boolean => {
  const providers = getIdentityProviders(user);
  return providers.has("google") && !providers.has("email");
};

export const AccountSettings = ({ user }: AccountSettingsProps) => {
  const { toast } = useToast();
  const [email, setEmail] = useState(user?.email || "");
  const [loading, setLoading] = useState(false);
  const [addingPassword, setAddingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(() => isGoogleOnlyAccount(user));
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;

    setEmail(user?.email || "");
    setNeedsPassword(isGoogleOnlyAccount(user));
    setNewPassword("");
    setConfirmPassword("");
    void fetchProfile(user.id).then((data) => {
      if (active && data) setProfile(data);
    });

    return () => {
      active = false;
    };
  }, [user]);

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    
    setLoading(true);
    try {
      await sendPasswordResetEmail(user.email, getPasswordResetRedirectUrl());

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

  const handleAddPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords do not match",
        description: "Enter the same password in both fields.",
      });
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      toast({
        variant: "destructive",
        title: "Invalid password",
        description: passwordValidation.error,
      });
      return;
    }

    setAddingPassword(true);
    try {
      await updatePassword(newPassword);
      setNeedsPassword(false);
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Brack password added",
        description: "You can now sign in with Google or your email and password. Your account and profile stay the same.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Password could not be added",
        description: "Sign in with Google again, then return here and retry.",
      });
    } finally {
      setAddingPassword(false);
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
          <CardTitle className="font-display">Email Address</CardTitle>
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
          <CardTitle className="font-display">
            {needsPassword ? "Add a Brack password" : "Password"}
          </CardTitle>
          <CardDescription className="font-sans">
            {needsPassword
              ? "Add email-and-password sign-in to this same Brack account. This does not create another account or profile, and Google sign-in will keep working."
              : "Change your password to keep your account secure"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {needsPassword ? (
            <form className="space-y-4" onSubmit={handleAddPassword}>
              <div className="space-y-2">
                <Label htmlFor="account-new-password">New password</Label>
                <Input
                  id="account-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  aria-describedby="account-password-requirements"
                  required
                />
                <p
                  id="account-password-requirements"
                  className="text-xs text-muted-foreground"
                >
                  Use 8 to 128 characters with uppercase, lowercase, and a number.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-confirm-password">Confirm password</Label>
                <Input
                  id="account-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <Button type="submit" disabled={addingPassword}>
                {addingPassword ? "Adding password..." : "Add password to this account"}
              </Button>
            </form>
          ) : (
            <Button
              onClick={handlePasswordReset}
              disabled={loading}
              variant="outline"
            >
              {loading ? "Sending..." : "Send Password Reset Email"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Account Created */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
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
        </CardContent>
      </Card>

      {/* Subscription (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
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
