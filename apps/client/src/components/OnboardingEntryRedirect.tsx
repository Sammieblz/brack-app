import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandedRouteTransition } from "@/components/animations/BrandedRouteTransition";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getAuthSession } from "@/services/api";
import { resolvePostAuthPath } from "@/services/authRedirect";
import { isOnboardingBackendUnavailable } from "@/services/onboarding";

export const OnboardingEntryRedirect = () => {
  const navigate = useNavigate();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    const resolveTarget = async () => {
      const session = await getAuthSession();
      const user = session?.user;

      if (!user) {
        setTarget("/onboarding");
        return;
      }

      setTarget(await resolvePostAuthPath());
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
      message={
        target.startsWith("/onboarding")
          ? "Opening setup..."
          : target === "/app-permissions"
            ? "Preparing Brack for this device..."
            : "Opening your dashboard..."
      }
    />
  );
};
