import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandedRouteTransition } from "@/components/animations/BrandedRouteTransition";
import { useToast } from "@/hooks/use-toast";
import {
  getAuthSession,
  handleAuthCallbackUrl,
  updatePassword,
} from "@/services/api";
import { resolvePostAuthPath } from "@/services/authRedirect";
import { validatePassword } from "@/utils/authValidation";

type ResetTransition = {
  to: string;
  message: string;
};

const hasAuthParams = (url: string) => {
  const parsed = new URL(url);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  return Boolean(
    parsed.searchParams.get("code") ||
      parsed.searchParams.get("access_token") ||
      hashParams.get("code") ||
      hashParams.get("access_token") ||
      parsed.searchParams.get("error") ||
      hashParams.get("error")
  );
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transition, setTransition] = useState<ResetTransition | null>(null);

  useEffect(() => {
    let cancelled = false;

    const prepareRecoverySession = async () => {
      try {
        if (hasAuthParams(window.location.href)) {
          await handleAuthCallbackUrl(window.location.href);
          navigate("/auth/reset-password", { replace: true });
        }

        const session = await getAuthSession();
        if (!session) {
          throw new Error("This reset link is invalid or has expired. Request a new password reset link.");
        }
      } catch (resetError) {
        console.error("Failed to prepare password reset:", resetError);
        if (!cancelled) {
          setError(
            resetError instanceof Error
              ? resetError.message
              : "This reset link is invalid or has expired."
          );
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    prepareRecoverySession();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
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

    setLoading(true);

    try {
      await updatePassword(newPassword);
      toast({
        title: "Password updated",
        description: "Your Brack password has been changed.",
      });

      const nextPath = await resolvePostAuthPath();
      setTransition({
        to: nextPath,
        message:
          nextPath === "/onboarding"
            ? "Opening your setup..."
            : "Opening your reading dashboard...",
      });
    } catch (updateError) {
      toast({
        variant: "destructive",
        title: "Password update failed",
        description:
          updateError instanceof Error ? updateError.message : "Unable to update your password.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (transition) {
    return <BrandedRouteTransition to={transition.to} message={transition.message} />;
  }

  if (pageLoading) {
    return (
      <div className="flex min-h-app-viewport items-center justify-center bg-gradient-background">
        <LoadingSpinner size="lg" text="Opening reset link..." />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-app-viewport items-center justify-center overflow-x-hidden overflow-y-auto bg-gradient-background px-4 py-8">
      <ThemeToggle />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-glow/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg relative z-10 animate-fade-in safe-top">
        <div className="text-center mb-6 md:mb-8 animate-slide-up">
          <div className="flex flex-col items-center gap-3 mb-4">
            <ThemeAwareLogo variant="icon" tone="theme" size="h-16 w-16" className="drop-shadow-lg" />
            <span className="font-display text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              BRACK
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-foreground">Choose New Password</h1>
            <p className="font-sans text-muted-foreground text-sm">
              Keep it strong, memorable, and unique to Brack.
            </p>
          </div>
        </div>

        <Card className="bg-gradient-card shadow-medium border-0 animate-scale-in" style={{ animationDelay: "0.2s" }}>
          <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
            {error ? (
              <div className="space-y-4">
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
                <Button
                  type="button"
                  className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium"
                  onClick={() => navigate("/auth?mode=reset", { replace: true })}
                >
                  Request New Link
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm font-medium">
                    New password
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter a new password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="h-12 border-border/50 focus:border-primary transition-colors"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-12 border-border/50 focus:border-primary transition-colors"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Updating...</span>
                    </div>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6 animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <button
            type="button"
            onClick={() => navigate("/auth?mode=signin", { replace: true })}
            className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300 font-medium"
          >
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
