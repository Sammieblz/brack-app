import { useCallback, useState, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import { BrandedRouteTransition } from "@/components/animations/BrandedRouteTransition";
import {
  AuthTurnstile,
  type AuthTurnstileHandle,
} from "@/components/auth/AuthTurnstile";
import {
  resendSignUpEmail,
  sendPasswordResetEmail,
  signInWithEmailPassword,
  signInWithOAuth,
  signUpWithEmail,
  verifyEmailOtp,
} from "@/services/api";
import {
  authorizePasswordRecoverySession,
  resolvePostAuthPath,
} from "@/services/authRedirect";
import { getAuthRedirectUrl, getPasswordResetRedirectUrl } from "@/services/platform";
import { validatePassword } from "@/utils/authValidation";
import {
  presentAuthFailure,
  type AuthFailurePresentation,
} from "@/services/authFailure";
import { useAuth } from "@/hooks/useAuth";
import {
  isValidTurnstileToken,
  type TurnstileAction,
} from "@/utils/turnstile";
import { Mail } from "iconoir-react";
import {
  beginOnboardingSignupAttempt,
  canAccessOnboardingSignup,
  cancelOnboardingSignupAttempt,
} from "@/services/onboardingDraft";

type AuthTransition = {
  to: string;
  message: string;
};

type EmailChallenge = {
  email: string;
  type: "signup" | "recovery";
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isPasswordResetRequest, setIsPasswordResetRequest] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [transition, setTransition] = useState<AuthTransition | null>(null);
  const [emailChallenge, setEmailChallenge] = useState<EmailChallenge | null>(null);
  const [emailOtp, setEmailOtp] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [authFailure, setAuthFailure] = useState<AuthFailurePresentation | null>(null);
  const [emailDeliveryBlocked, setEmailDeliveryBlocked] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<AuthTurnstileHandle>(null);
  const authRequestInFlightRef = useRef(false);
  const recoveryOtpInFlightRef = useRef(false);
  const postAuthResolutionRef = useRef<Promise<AuthTransition> | null>(null);
  const { toast } = useToast();
  const { resetToDefaultTheme } = useTheme();
  const { user: authUser, loading: authLoading } = useAuth();
  const captchaAction: TurnstileAction = emailChallenge
    ? emailChallenge.type === "signup"
      ? "resend_sign_up"
      : "resend_recovery"
    : isPasswordResetRequest
      ? "password_reset"
      : isSignUp
        ? "sign_up"
        : "sign_in";
  const captchaReady = isValidTurnstileToken(captchaToken);

  const resolveSignedInTransition = useCallback(async () => {
    if (!postAuthResolutionRef.current) {
      postAuthResolutionRef.current = resolvePostAuthPath()
        .then((path) => ({
          to: path,
          message: path.startsWith("/onboarding")
            ? "Setting up your Brack profile..."
            : path === "/app-permissions"
              ? "Preparing Brack for this device..."
              : "Opening your reading dashboard...",
        }))
        .catch((error) => {
          postAuthResolutionRef.current = null;
          throw error;
        });
    }

    return postAuthResolutionRef.current;
  }, []);

  // Force the public theme only after the single shared Auth store has
  // conclusively restored (or not restored) the local session.
  useEffect(() => {
    if (!authLoading && !authUser) resetToDefaultTheme();
  }, [authLoading, authUser, resetToDefaultTheme]);

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
    if (
      mode === "signup" &&
      !authLoading &&
      !authUser &&
      !canAccessOnboardingSignup()
    ) {
      navigate("/onboarding?from=auth", { replace: true });
      return;
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
  }, [authLoading, authUser, navigate, searchParams]);

  useEffect(() => {
    if (authLoading || !authUser || recoveryOtpInFlightRef.current) return;

    let active = true;
    resolveSignedInTransition()
      .then((nextTransition) => {
        if (active) setTransition((current) => current ?? nextTransition);
      })
      .catch((error) => {
        console.error("Failed to resolve post-auth route:", error);
        if (active) {
          setTransition((current) => current ?? {
            to: "/dashboard",
            message: "Opening your reading dashboard...",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, authUser, resolveSignedInTransition]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCountdown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  useLayoutEffect(() => {
    setCaptchaToken(null);
  }, [captchaAction]);

  if (transition) {
    return <BrandedRouteTransition to={transition.to} message={transition.message} />;
  }

  if (authLoading) {
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

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    if (isSignUp && !isPasswordResetRequest) {
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
    }

    if (!captchaReady) {
      setAuthFailure({
        title: "Security check needed",
        description: "Wait for the security check to finish, then try again.",
        rateLimited: false,
      });
      return;
    }

    const requestCaptchaToken = captchaToken;

    authRequestInFlightRef.current = true;
    setLoading(true);
    setAuthFailure(null);

    const isOnboardingSignup =
      isSignUp || emailChallenge?.type === "signup";
    if (isOnboardingSignup) {
      const signupDraft = beginOnboardingSignupAttempt({
        kind: "oauth",
        provider: "google",
      });
      if (!signupDraft) {
        authRequestInFlightRef.current = false;
        setLoading(false);
        navigate("/onboarding?from=auth", { replace: true });
        return;
      }
    }

    try {
      if (isPasswordResetRequest) {
        await sendPasswordResetEmail({
          email,
          redirectTo: getPasswordResetRedirectUrl(),
          captchaToken: requestCaptchaToken,
        });

        toast({
          title: "Reset request received",
          description:
            "If this address is connected to Brack, enter the six-digit code from the newest email here.",
        });
        setEmailChallenge({ email: email.trim(), type: "recovery" });
        setEmailOtp("");
        setResendCountdown(60);
        setPassword("");
      } else if (isSignUp) {
        const signupDraft = beginOnboardingSignupAttempt({
          kind: "email",
          email,
        });
        if (!signupDraft) {
          navigate("/onboarding?from=auth", { replace: true });
          return;
        }

        const outcome = await signUpWithEmail({
          email,
          password,
          captchaToken: requestCaptchaToken,
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
          cancelOnboardingSignupAttempt();
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
            "Check your inbox and enter the six-digit confirmation code here. You can also use the email link as a fallback.",
        });
        setPassword("");
        setEmailChallenge({ email: outcome.email, type: "signup" });
        setEmailOtp("");
        setResendCountdown(60);
      } else {
        await signInWithEmailPassword({
          email,
          password,
          captchaToken: requestCaptchaToken,
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
      if (
        operation === "sign_up" &&
        (failure.rateLimited ||
          (!failure.confirmationRequired && failure.title !== "Sign-up failed"))
      ) {
        cancelOnboardingSignupAttempt();
      }
      setAuthFailure(failure);
      if (failure.confirmationRequired) {
        setEmailChallenge({ email: email.trim(), type: "signup" });
        setEmailOtp("");
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
      captchaRef.current?.reset();
    }
  };

  const handleVerifyEmailOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!emailChallenge || authRequestInFlightRef.current) return;

    if (!/^\d{6}$/.test(emailOtp)) {
      setAuthFailure({
        title: "Enter the complete code",
        description: "Use the six-digit code from the newest Brack email.",
        rateLimited: false,
      });
      return;
    }

    authRequestInFlightRef.current = true;
    recoveryOtpInFlightRef.current = emailChallenge.type === "recovery";
    setLoading(true);
    setAuthFailure(null);

    try {
      const result = await verifyEmailOtp({
        email: emailChallenge.email,
        token: emailOtp,
        type: emailChallenge.type,
      });

      if (emailChallenge.type === "recovery") {
        const userId = result.user?.id ?? result.session?.user?.id;
        if (!userId) {
          throw new Error("The recovery code did not establish a verified session.");
        }

        authorizePasswordRecoverySession(userId);
        setTransition({
          to: "/auth/reset-password",
          message: "Opening your secure password change...",
        });
        return;
      }

      setTransition(await resolveSignedInTransition());
    } catch (error: unknown) {
      recoveryOtpInFlightRef.current = false;
      const failure = presentAuthFailure(
        error,
        emailChallenge.type === "recovery" ? "password_reset" : "sign_up",
      );
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
      if (isOnboardingSignup) cancelOnboardingSignupAttempt();
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

  const handleResendEmailChallenge = async () => {
    if (
      !emailChallenge ||
      resendCountdown > 0 ||
      emailDeliveryBlocked ||
      authRequestInFlightRef.current ||
      !captchaReady
    ) {
      return;
    }

    const requestCaptchaToken = captchaToken;

    authRequestInFlightRef.current = true;
    setLoading(true);
    setAuthFailure(null);

    try {
      if (emailChallenge.type === "signup") {
        await resendSignUpEmail({
          email: emailChallenge.email,
          redirectTo: getAuthRedirectUrl(),
          captchaToken: requestCaptchaToken,
        });
      } else {
        await sendPasswordResetEmail({
          email: emailChallenge.email,
          redirectTo: getPasswordResetRedirectUrl(),
          captchaToken: requestCaptchaToken,
        });
      }
      setEmailOtp("");
      setResendCountdown(60);
      toast({
        title:
          emailChallenge.type === "signup"
            ? "Confirmation request received"
            : "Reset request received",
        description:
          "If a message can be delivered for this address, use the newest six-digit code that arrives.",
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
      captchaRef.current?.reset();
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
              {emailChallenge
                ? emailChallenge.type === "recovery"
                  ? "Enter your reset code"
                  : "Confirm in this window"
                : isPasswordResetRequest
                  ? "Reset Password"
                  : isSignUp
                    ? "Join BRACK"
                    : "Welcome Back"}
            </h1>
            <p className="font-sans text-muted-foreground text-sm">
              {emailChallenge
                ? "Stay here and use the six-digit code from your email"
                : isPasswordResetRequest
                  ? "Request a code and reset your password in this window"
                  : isSignUp
                    ? "Start your reading journey today"
                    : "Continue your reading adventure"}
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="bg-gradient-card shadow-medium border-0 animate-scale-in" style={{ animationDelay: '0.2s' }}>
          <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
            {emailChallenge ? (
              <div className="space-y-5">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl shadow-soft">
                  <Mail className="h-8 w-8 text-primary" aria-hidden="true" />
                </div>
                <div className="space-y-2 text-center" aria-live="polite">
                  <p className="text-sm text-muted-foreground">
                    If a Brack message can be delivered for
                  </p>
                  <p className="break-all font-semibold text-foreground">
                    {emailChallenge.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    enter its newest six-digit code below. You can finish in
                    this {emailChallenge.type === "recovery" ? "password-reset" : "signup"} window without opening another app.
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

                <form className="space-y-4" onSubmit={handleVerifyEmailOtp}>
                  <div className="space-y-2">
                    <Label htmlFor="email-auth-code" className="sr-only">
                      Six-digit email code
                    </Label>
                    <InputOTP
                      id="email-auth-code"
                      value={emailOtp}
                      onChange={setEmailOtp}
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      containerClassName="justify-center"
                      disabled={loading}
                      aria-describedby="email-auth-code-help"
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }, (_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="h-11 w-10 text-base sm:w-11"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <p
                      id="email-auth-code-help"
                      className="text-center text-xs text-muted-foreground"
                    >
                      Codes expire after one hour. Only the newest email code works.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="h-12 w-full bg-gradient-primary text-white hover:shadow-glow"
                    disabled={loading || emailOtp.length !== 6}
                  >
                    {loading
                      ? "Verifying..."
                      : emailChallenge.type === "recovery"
                        ? "Continue password reset"
                        : "Confirm and continue"}
                  </Button>
                </form>

                {emailChallenge.type === "signup" && (
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
                )}

                {resendCountdown <= 0 && !emailDeliveryBlocked && (
                  <div className="space-y-2">
                    <p className="text-center text-xs text-muted-foreground">
                      A new email requires a fresh security check.
                    </p>
                    <AuthTurnstile
                      key={captchaAction}
                      ref={captchaRef}
                      action={captchaAction}
                      onTokenChange={setCaptchaToken}
                      disabled={loading}
                    />
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full"
                  disabled={
                    loading ||
                    resendCountdown > 0 ||
                    emailDeliveryBlocked ||
                    !captchaReady
                  }
                  onClick={handleResendEmailChallenge}
                >
                  {loading
                    ? "Requesting..."
                    : emailDeliveryBlocked
                      ? "Resend unavailable — try later"
                    : resendCountdown > 0
                      ? `Resend available in ${resendCountdown}s`
                      : emailChallenge.type === "recovery"
                        ? "Resend reset code"
                        : "Resend confirmation code"}
                </Button>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 w-full"
                    disabled={loading}
                    onClick={() => {
                      if (emailChallenge.type === "signup") {
                        cancelOnboardingSignupAttempt();
                      }
                      setEmailChallenge(null);
                      setEmailOtp("");
                      setIsSignUp(false);
                      setIsPasswordResetRequest(false);
                      setPassword("");
                      setAuthFailure(null);
                      setResendCountdown(0);
                      navigate("/auth?mode=signin", { replace: true });
                    }}
                  >
                    Sign in instead
                  </Button>
                  {emailChallenge.type === "signup" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 w-full"
                      disabled={loading}
                      onClick={() => {
                        cancelOnboardingSignupAttempt();
                        setEmailChallenge(null);
                        setEmailOtp("");
                        setIsSignUp(false);
                        setIsPasswordResetRequest(true);
                        setPassword("");
                        setAuthFailure(null);
                        setResendCountdown(0);
                      }}
                    >
                      Reset password
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-11 w-full"
                      disabled={loading}
                      onClick={() => {
                        setEmailChallenge(null);
                        setEmailOtp("");
                        setIsPasswordResetRequest(true);
                        setEmail("");
                        setAuthFailure(null);
                        setResendCountdown(0);
                      }}
                    >
                      Use another email
                    </Button>
                  )}
                </div>
                {emailChallenge.type === "signup" && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full"
                    disabled={loading}
                    onClick={() => {
                      setEmailChallenge(null);
                      setEmailOtp("");
                      setIsSignUp(true);
                      setIsPasswordResetRequest(false);
                      setEmail("");
                      setPassword("");
                      setFirstName("");
                      setLastName("");
                      setAuthFailure(null);
                      setResendCountdown(0);
                      cancelOnboardingSignupAttempt();
                    }}
                  >
                    Use a different email
                  </Button>
                )}
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
                If this address is connected to Brack, the email includes a six-digit code so you can remain in this window. A secure link is also included as a fallback. Brack does not reveal whether an account exists.
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

              <AuthTurnstile
                key={captchaAction}
                ref={captchaRef}
                action={captchaAction}
                onTokenChange={setCaptchaToken}
                disabled={loading}
              />
              
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium" 
                disabled={
                  loading ||
                  !captchaReady ||
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
                  "Send Reset Code"
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
        {!emailChallenge && (
        <div className="text-center mt-6 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <button
            type="button"
            onClick={() => {
              if (isPasswordResetRequest) {
                setIsPasswordResetRequest(false);
                setAuthFailure(null);
                setResendCountdown(0);
                navigate("/auth?mode=signin", { replace: true });
                return;
              }
              if (isSignUp) {
                cancelOnboardingSignupAttempt();
                navigate("/auth?mode=signin", { replace: true });
              } else {
                navigate("/onboarding?from=auth");
              }
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
