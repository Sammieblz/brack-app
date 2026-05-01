import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandedRouteTransition } from "@/components/animations/BrandedRouteTransition";
import LoadingSpinner from "@/components/LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureUserProfile,
  isOnboardingBackendUnavailable,
} from "@/services/onboarding";

export const OnboardingEntryRedirect = () => {
  const navigate = useNavigate();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const resolveTarget = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        navigate("/auth?mode=signup", { replace: true });
        return;
      }

      const status = await ensureUserProfile(user);
      setTarget(status.onboarding_status === "completed" ? "/dashboard" : "/onboarding");
    };

    resolveTarget().catch((err) => {
      console.error("Onboarding entry redirect failed:", err);
      if (isOnboardingBackendUnavailable(err)) {
        navigate("/onboarding", { replace: true });
        return;
      }

      navigate("/dashboard", { replace: true });
    });
  }, [navigate]);

  if (!target) {
    return (
      <div className="flex min-h-app-viewport items-center justify-center bg-background">
        <LoadingSpinner size="lg" text="Opening setup..." />
      </div>
    );
  }

  return (
    <BrandedRouteTransition
      to={target}
      message={target === "/onboarding" ? "Opening setup..." : "Opening your dashboard..."}
    />
  );
};
