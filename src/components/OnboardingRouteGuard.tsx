import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  ensureUserProfile,
  isOnboardingBackendUnavailable,
  shouldEnterFirstRunOnboarding,
} from "@/services/onboarding";

const PUBLIC_ROUTES = new Set(["/", "/auth"]);

export const OnboardingRouteGuard = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const lastDecisionRef = useRef<string>("");

  useEffect(() => {
    if (loading) return;

    let cancelled = false;

    const runGuard = async () => {
      const decisionKey = `${user?.id ?? "anonymous"}:${location.pathname}:${location.search}`;
      if (lastDecisionRef.current === decisionKey) return;
      lastDecisionRef.current = decisionKey;

      if (!user) {
        if (location.pathname === "/onboarding") {
          navigate("/auth?mode=signup", { replace: true });
        }
        return;
      }

      const statusRecord = await ensureUserProfile(user);
      if (cancelled) return;

      const status = statusRecord.onboarding_status;
      const shouldForceOnboarding = shouldEnterFirstRunOnboarding(user, statusRecord);
      const isOnboardingRoute = location.pathname === "/onboarding";
      const allowCompletedEdit =
        location.search.includes("edit=1") ||
        location.search.includes("from=settings") ||
        location.search.includes("from=dashboard");

      if (location.pathname === "/auth") {
        navigate(shouldForceOnboarding ? "/onboarding" : "/dashboard", {
          replace: true,
        });
        return;
      }

      if (isOnboardingRoute) {
        if ((status === "completed" || !shouldForceOnboarding) && !allowCompletedEdit) {
          navigate("/dashboard", { replace: true });
        }
        return;
      }

      if (!PUBLIC_ROUTES.has(location.pathname) && shouldForceOnboarding) {
        navigate("/onboarding", { replace: true });
      }
    };

    runGuard().catch((err) => {
      if (isOnboardingBackendUnavailable(err)) {
        console.warn("Onboarding route guard skipped until the onboarding schema is available:", err);
        return;
      }

      console.error("Onboarding route guard failed:", err);
    });

    return () => {
      cancelled = true;
    };
  }, [loading, location.pathname, location.search, navigate, user]);

  return null;
};
