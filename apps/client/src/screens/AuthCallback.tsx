import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  AuthCallbackBootstrapError,
  completeAuthCallback,
} from "@/services/authRedirect";
import { Button } from "@/components/ui/button";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { publishAuthFlowCompletion } from "@/services/authFlowBridge";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [returningToRequest, setReturningToRequest] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const finishAuth = async () => {
      const callbackUrl = window.location.href;
      if (window.location.pathname === "/auth/callback") {
        window.history.replaceState(window.history.state, "", "/auth/callback");
      }

      try {
        const nextPath = await completeAuthCallback(callbackUrl);
        if (!cancelled) {
          if (publishAuthFlowCompletion()) {
            setReturningToRequest(true);
            window.close();
            return;
          }
          navigate(nextPath, { replace: true });
        }
      } catch (authError) {
        console.error("Failed to complete auth callback:", authError);
        if (authError instanceof AuthCallbackBootstrapError) {
          if (!cancelled) {
            navigate(authError.fallbackPath, { replace: true });
          }
          return;
        }

        if (!cancelled) {
          setError(
            "This sign-in link could not be completed. It may be expired or already used.",
          );
        }
      }
    };

    finishAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!error) {
    return (
      <div className="flex min-h-app-viewport items-center justify-center bg-gradient-background px-4">
        <LoadingSpinner
          size="lg"
          text={returningToRequest ? "Returning to your sign-up..." : "Finishing sign in..."}
        />
      </div>
    );
  }

  return (
    <main className="flex min-h-app-viewport items-center justify-center bg-gradient-background px-4">
      <section
        className="w-full max-w-md rounded-3xl border border-border/40 bg-card/95 p-6 text-center shadow-medium backdrop-blur md:p-8"
        role="alert"
      >
        <ThemeAwareLogo variant="icon" size="h-14 w-14" className="mx-auto mb-5" />
        <h1 className="font-display text-2xl font-bold text-foreground">
          Sign-in link unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{error}</p>
        <Button className="mt-6 h-12 w-full" onClick={() => navigate("/auth", { replace: true })}>
          Return to sign in
        </Button>
      </section>
    </main>
  );
};

export default AuthCallback;
