import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import { BrandedRouteTransition } from "@/components/animations/BrandedRouteTransition";
import {
  getAuthSession,
  onAuthStateChange,
  resendSignUpEmail,
  sendPasswordResetEmail,
  signInWithEmailPassword,
  signInWithOAuth,
  signUpWithEmail,
} from "@/services/api";
import { resolvePostAuthPath } from "@/services/authRedirect";
import { getAuthRedirectUrl, getPasswordResetRedirectUrl } from "@/services/platform";
import { validatePassword } from "@/utils/authValidation";
import {
  presentAuthFailure,
  type AuthFailurePresentation,
} from "@/services/authFailure";
import { Mail } from "iconoir-react";

type AuthTransition = {
  to: string;
  message: string;
};

const GoogleMark = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const EMAIL_EXISTS_FAILURE: AuthFailurePresentation = {
  title: "Email already exists",
  description:
    "This email is already used by another reader. Sign in instead, or continue with Google if you originally joined with Google.",
  rateLimited: false,
};

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isPasswordResetRequest, setIsPasswordResetRequest] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [transition, setTransition] = useState<AuthTransition | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [authFailure, setAuthFailure] = useState<AuthFailurePresentation | null>(null);
  const [emailDeliveryBlocked, setEmailDeliveryBlocked] = useState(false);
  const authRequestInFlightRef = useRef(false);
  const { toast } = useToast();
  const { resetToDefaultTheme } = useTheme();

  const resolveSignedInTransition = async () => {
    const path = await resolvePostAuthPath();
    const needsOnboarding = path === "/onboarding";

    return {
      to: path,
      message: needsOnboarding
        ? "Setting up your Brack profile..."
        : "Opening your reading dashboard...",
    };
  };

  // Force default theme on auth page (only if not authenticated)
  useEffect(() => {
    const checkAndResetTheme = async () => {
      const session = await getAuthSession();
      // Only reset theme if user is not authenticated
      if (!session) {
        resetToDefaultTheme();
      }
    };
    checkAndResetTheme();
  }, [resetToDefaultTheme]);

  // Read URL params to set sign-up/sign-in mode
  useEffect(() => {
    const mode = searchParams.get("mode");
    if (searchParams.get("auth_error") === "callback") {
      setAuthFailure({
        title: "Sign-in link unavailable",
        description:
          "This sign-in link could not be completed. It may be expired or already used.",
        rateLimited: false,
      });
    }
    if (mode === "signup") {
      setIsSignUp(true);
      setIsPasswordResetRequest(false);
    } else if (mode === "signin") {
      setIsSignUp(false);
      setIsPasswordResetRequest(false);
    } else if (mode === "reset") {
      setIsSignUp(false);
      setIsPasswordResetRequest(true);
    }
    // If no mode param, keep default (sign-in)
  }, [searchParams]);

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      try {
        const session = await getAuthSession();
        if (session) {
          setTransition(await resolveSignedInTransition());
          return;
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setPageLoading(false);
      }
    };
    checkUser();

    // Listen for auth changes
    const subscription = onAuthStateChange(
      (event, session) => {
        if (session && event === 'SIGNED_IN') {
          resolveSignedInTransition()
            .then((nextTransition) => {
              setTransition((current) => current ?? nextTransition);
            })
            .catch((error) => {
              console.error("Failed to resolve post-auth route:", error);
              setTransition((current) => current ?? {
                to: "/dashboard",
                message: "Opening your reading dashboard...",
              });
            });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [isSignUp]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCountdown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  if (transition) {
    return <BrandedRouteTransition to={transition.to} message={transition.message} />;
  }

  if (pageLoading) {
    return (
      <div className="flex min-h-app-viewport items-center justify-center bg-gradient-background">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      authRequestInFlightRef.current ||
      (emailDeliveryBlocked && (isSignUp || isPasswordResetRequest))
    ) {
      return;
    }

    authRequestInFlightRef.current = true;
    setLoading(true);
    setAuthFailure(null);

    try {
      if (isPasswordResetRequest) {
        await sendPasswordResetEmail(email, getPasswordResetRedirectUrl());

        toast({
          title: "Reset request received",
          description:
            "If this address is connected to a Brack account, a reset link may arrive shortly.",
        });
        setIsPasswordResetRequest(false);
        setPassword("");
      } else if (isSignUp) {
        const normalizedFirstName = firstName.trim();
        const normalizedLastName = lastName.trim();
        if (!normalizedFirstName || !normalizedLastName) {
          toast({
            variant: "destructive",
            title: "Enter your name",
            description: "First and last name cannot be blank.",
          });
          return;
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          toast({
            variant: "destructive",
            title: "Invalid password",
            description: passwordValidation.error,
          });
          return;
        }

        const outcome = await signUpWithEmail({
          email,
          password,
          redirectTo: getAuthRedirectUrl(),
          metadata: {
            first_name: normalizedFirstName,
            last_name: normalizedLastName,
            full_name: `${normalizedFirstName} ${normalizedLastName}`,
          },
        });

        if (outcome.kind === "signed_in") {
          setTransition(await resolveSignedInTransition());
          return;
        }

        if (outcome.kind === "email_exists") {
          setAuthFailure(EMAIL_EXISTS_FAILURE);
          setPassword("");
          toast({
            variant: "destructive",
            title: EMAIL_EXISTS_FAILURE.title,
            description: EMAIL_EXISTS_FAILURE.description,
          });
          return;
        }

        toast({
          title: "Account request received",
          description:
            "This does not mean a second account was created. Check your inbox, sign in, or use your original provider.",
        });
        setPassword("");
        setConfirmationEmail(outcome.email);
        setResendCountdown(60);
      } else {
        await signInWithEmailPassword({
          email,
          password,
        });

        setTransition(await resolveSignedInTransition());
      }
    } catch (error: unknown) {
      const operation = isPasswordResetRequest
        ? "password_reset"
        : isSignUp
          ? "sign_up"
          : "sign_in";
      const failure = presentAuthFailure(error, operation);
      setAuthFailure(failure);
      if (failure.confirmationRequired) {
        setConfirmationEmail(email.trim());
        setPassword("");
        setResendCountdown(0);
      }
      if (failure.rateLimited) {
        setResendCountdown(0);
        if (operation === "sign_up" || operation === "password_reset") {
          setEmailDeliveryBlocked(true);
        }
      }
      toast({
        variant: "destructive",
        title: failure.title,
        description: failure.description,
      });
    } finally {
      authRequestInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (authRequestInFlightRef.current) return;

    authRequestInFlightRef.current = true;
    setLoading(true);
    setAuthFailure(null);
    
    try {
      await signInWithOAuth({
        provider: 'google',
        redirectTo: getAuthRedirectUrl(),
      });
    } catch (error: unknown) {
      const failure = presentAuthFailure(error, "oauth");
      setAuthFailure(failure);
      toast({
        variant: "destructive",
        title: failure.title,
        description: failure.description,
      });
    } finally {
      authRequestInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (
      !confirmationEmail ||
      resendCountdown > 0 ||
      emailDeliveryBlocked ||
      authRequestInFlightRef.current
    ) {
      return;
    }

    authRequestInFlightRef.current = true;
    setLoading(true);
    setAuthFailure(null);

    try {
      await resendSignUpEmail({
        email: confirmationEmail,
        redirectTo: getAuthRedirectUrl(),
      });
      setResendCountdown(60);
      toast({
        title: "Confirmation request received",
        description:
          "If a confirmation message can be delivered for this address, use the newest Brack link that arrives.",
      });
    } catch (error: unknown) {
      const failure = presentAuthFailure(error, "resend");
      setAuthFailure(failure);
      if (failure.rateLimited) {
        setResendCountdown(0);
        setEmailDeliveryBlocked(true);
      }
      toast({
        variant: "destructive",
        title: failure.title,
        description: failure.description,
      });
    } finally {
      authRequestInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-app-viewport items-center justify-center overflow-x-hidden overflow-y-auto bg-gradient-background px-4 py-8">
      {/* Light/Dark toggle */}
      <ThemeToggle />

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-glow/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      </div>
      
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg relative z-10 animate-fade-in safe-top">
        {/* Logo Section — Brack icon + heading */}
        <div className="text-center mb-6 md:mb-8 animate-slide-up">
          <div className="flex flex-col items-center gap-3 mb-4">
            <ThemeAwareLogo variant="icon" size="h-16 w-16" className="drop-shadow-lg" />
            <span className="font-display text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              BRACK
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {confirmationEmail
                ? "Check your sign-in options"
                : isPasswordResetRequest
                  ? "Reset Password"
                  : isSignUp
                    ? "Join BRACK"
                    : "Welcome Back"}
            </h1>
            <p className="font-sans text-muted-foreground text-sm">
              {confirmationEmail
                ? "Choose the next step that works for you"
                : isPasswordResetRequest
                  ? "Enter your email to request a secure reset link"
                  : isSignUp
                    ? "Start your reading journey today"
                    : "Continue your reading adventure"}
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="bg-gradient-card shadow-medium border-0 animate-scale-in" style={{ animationDelay: '0.2s' }}>
          <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
            {confirmationEmail ? (
              <div className="space-y-5" role="status" aria-live="polite">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl shadow-soft">
                  <Mail className="h-8 w-8 text-primary" aria-hidden="true" />
                </div>
                <div className="space-y-2 text-center">
                  <p className="text-sm text-muted-foreground">
                    If a confirmation message can be delivered for
                  </p>
                  <p className="break-all font-semibold text-foreground">
                    {confirmationEmail}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    it may arrive shortly. Use only the newest Brack link that arrives.
                  </p>
                  <p className="rounded-xl border border-border/60 bg-muted/35 px-3 py-2 text-left text-xs text-muted-foreground">
                    This request does not confirm that a new account was created. Brack keeps one account and one profile per email. If this address already belongs to Brack, including through Google, the names and password entered in this request were ignored.
                  </p>
                </div>

                {authFailure && (
                  <div
                    className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3"
                    role="alert"
                  >
                    <p className="text-sm font-semibold text-foreground">{authFailure.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{authFailure.description}</p>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full gap-3 bg-white text-gray-700 hover:bg-gray-50"
                  disabled={loading}
                  onClick={handleGoogleAuth}
                >
                  <GoogleMark />
                  Continue with Google
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full"
                  disabled={loading || resendCountdown > 0 || emailDeliveryBlocked}
                  onClick={handleResendConfirmation}
                >
                  {loading
                    ? "Requesting..."
                    : emailDeliveryBlocked
                      ? "Resend unavailable — try later"
                    : resendCountdown > 0
                      ? `Resend available in ${resendCountdown}s`
                      : "Resend confirmation"}
                </Button>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 w-full"
                    disabled={loading}
                    onClick={() => {
                      setConfirmationEmail(null);
                      setIsSignUp(false);
                      setIsPasswordResetRequest(false);
                      setPassword("");
                      setAuthFailure(null);
                      setResendCountdown(0);
                    }}
                  >
                    Sign in instead
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 w-full"
                    disabled={loading}
                    onClick={() => {
                      setConfirmationEmail(null);
                      setIsSignUp(false);
                      setIsPasswordResetRequest(true);
                      setPassword("");
                      setAuthFailure(null);
                      setResendCountdown(0);
                    }}
                  >
                    Reset password
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full"
                  disabled={loading}
                  onClick={() => {
                    setConfirmationEmail(null);
                    setIsSignUp(true);
                      setIsPasswordResetRequest(false);
                      setEmail("");
                      setPassword("");
                      setFirstName("");
                      setLastName("");
                      setAuthFailure(null);
                    setResendCountdown(0);
                  }}
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <>
            {!isPasswordResetRequest && (
              <>
                <Button
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  variant="outline"
                  className="w-full h-12 text-sm font-medium border border-border/30 hover:border-border/50 bg-white hover:bg-gray-50 text-gray-700 hover:shadow-soft transition-all duration-300 flex items-center justify-center space-x-3"
                >
                  <GoogleMark />
                  <span>Continue with Google</span>
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/30" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 text-muted-foreground font-medium">
                      Or continue with email
                    </span>
                  </div>
                </div>
              </>
            )}

            {isPasswordResetRequest && (
              <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                If this address is connected to Brack, a reset link may arrive shortly. Brack does not reveal whether an account exists.
              </div>
            )}

            {authFailure && (
              <div
                className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3"
                role="alert"
              >
                <p className="text-sm font-semibold text-foreground">{authFailure.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{authFailure.description}</p>
              </div>
            )}
            
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isSignUp && !isPasswordResetRequest && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="First name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="h-12 border-border/50 focus:border-primary transition-colors"
                        required={isSignUp}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Last name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="h-12 border-border/50 focus:border-primary transition-colors"
                        required={isSignUp}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-border/50 focus:border-primary transition-colors"
                  required
                />
              </div>
              
              {!isPasswordResetRequest && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPasswordResetRequest(true);
                          setPassword("");
                        }}
                        className="text-xs font-medium text-primary hover:text-primary-glow transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 border-border/50 focus:border-primary transition-colors"
                    required
                  />
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium" 
                disabled={
                  loading ||
                  (emailDeliveryBlocked && (isSignUp || isPasswordResetRequest))
                }
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : emailDeliveryBlocked && (isSignUp || isPasswordResetRequest) ? (
                  "Email unavailable — try later"
                ) : isPasswordResetRequest ? (
                  "Send Reset Link"
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
              </>
            )}
          </CardContent>
        </Card>
        
        {/* Switch Mode */}
        {!confirmationEmail && (
        <div className="text-center mt-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <button
            type="button"
            onClick={() => {
              if (isPasswordResetRequest) {
                setIsPasswordResetRequest(false);
                setAuthFailure(null);
                setResendCountdown(0);
                return;
              }
              setIsSignUp(!isSignUp);
              setAuthFailure(null);
              setResendCountdown(0);
            }}
            className="text-sm text-muted-foreground hover:text-primary transition-colors duration-300 font-medium"
          >
            {isPasswordResetRequest
              ? "Back to sign in"
              : isSignUp
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
          </button>
        </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
