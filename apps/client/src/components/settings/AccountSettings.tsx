import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { fetchProfile, signInWithEmailPassword, updatePassword } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { validatePassword } from "@/utils/authValidation";
import {
  AuthTurnstile,
  type AuthTurnstileHandle,
} from "@/components/auth/AuthTurnstile";
import { isValidTurnstileToken } from "@/utils/turnstile";
import { presentAuthFailure } from "@/services/authFailure";
import { isAuthError } from "@supabase/supabase-js";
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
  const [changingPassword, setChangingPassword] = useState(false);
  const [addingPassword, setAddingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<AuthTurnstileHandle>(null);
  const [needsPassword, setNeedsPassword] = useState(() => isGoogleOnlyAccount(user));
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;

    setEmail(user?.email || "");
    setNeedsPassword(isGoogleOnlyAccount(user));
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    void fetchProfile(user.id).then((data) => {
      if (active && data) setProfile(data);
    });

    return () => {
      active = false;
    };
  }, [user]);

  const validateNewPassword = (): boolean => {
    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords do not match",
        description: "Enter the same password in both fields.",
      });
      return false;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      toast({
        variant: "destructive",
        title: "Invalid password",
        description: passwordValidation.error,
      });
      return false;
    }

    return true;
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user.email || !validateNewPassword()) return;
    if (!isValidTurnstileToken(captchaToken)) {
      toast({
        variant: "destructive",
        title: "Security check needed",
        description: "Wait for the security check to finish, then try again.",
      });
      return;
    }

    const requestCaptchaToken = captchaToken;

    setChangingPassword(true);
    try {
      try {
        await signInWithEmailPassword({
          email: user.email,
          password: currentPassword,
          captchaToken: requestCaptchaToken,
        });
      } catch (error: unknown) {
        const invalidCurrentPassword =
          isAuthError(error) && error.code === "invalid_credentials";
        const failure = presentAuthFailure(error, "sign_in");
        toast({
          variant: "destructive",
          title: invalidCurrentPassword
            ? "Current password not accepted"
            : failure.title,
          description: invalidCurrentPassword
            ? "Check your current password and try again. If you have forgotten it, use the reset option below."
            : failure.description,
        });
        return;
      }

      await updatePassword(newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password updated",
        description: "Your new password is ready to use on this account.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Password could not be updated",
        description: "Your current password was verified, but Brack could not save the new one. Try again.",
      });
    } finally {
      setChangingPassword(false);
      captchaRef.current?.reset();
    }
  };

  const handleAddPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateNewPassword()) return;

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
            <form className="space-y-4" onSubmit={handleChangePassword}>
              <div className="space-y-2">
                <Label htmlFor="account-current-password">Current password</Label>
                <Input
                  id="account-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-change-new-password">New password</Label>
                <Input
                  id="account-change-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  aria-describedby="account-change-password-requirements"
                  required
                />
                <p
                  id="account-change-password-requirements"
                  className="text-xs text-muted-foreground"
                >
                  Use 8 to 128 characters with uppercase, lowercase, and a number.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-change-confirm-password">Confirm new password</Label>
                <Input
                  id="account-change-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <AuthTurnstile
                ref={captchaRef}
                action="change_password"
                onTokenChange={setCaptchaToken}
                disabled={changingPassword}
              />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="submit"
                  disabled={changingPassword || !isValidTurnstileToken(captchaToken)}
                >
                  {changingPassword ? "Updating password..." : "Update password"}
                </Button>
                <Button asChild type="button" variant="ghost">
                  <a href="/auth?mode=reset">Forgot current password?</a>
                </Button>
              </div>
            </form>
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
