import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { resolvePostAuthPath } from "@/services/authRedirect";
import { isOnboardingBackendUnavailable } from "@/services/onboarding";

const AUTH_HANDOFF_ROUTES = new Set([
  "/auth",
  "/auth/callback",
  "/auth/reset-password",
]);
const LEGACY_ONBOARDING_ROUTES = new Set([
  "/welcome",
  "/questionnaire",
  "/goals",
]);

type PendingDecision = {
  key: string;
  promise: Promise<string>;
};

export const OnboardingRouteGuard = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pendingDecisionRef = useRef<PendingDecision | null>(null);

  useEffect(() => {
    if (loading) return;

    const { pathname, search } = location;

    // These screens own their own redirect lifecycle. In particular, Auth and
    // AuthCallback must finish the draft before any global guard moves the
    // reader elsewhere.
    if (pathname === "/" || AUTH_HANDOFF_ROUTES.has(pathname)) return;

    if (!user) {
      // Pre-auth onboarding is intentionally public. Native permissions are
      // account-scoped and cannot be entered anonymously.
      if (pathname === "/app-permissions") {
        navigate("/auth?mode=signin", { replace: true });
      }
      return;
    }

    // Legacy URLs have a dedicated transition component which also uses the
    // shared resolver. Leaving them alone avoids a second profile request.
    if (LEGACY_ONBOARDING_ROUTES.has(pathname)) return;

    let cancelled = false;
    const decisionKey = `${user.id}:${pathname}:${search}`;
    let decision = pendingDecisionRef.current;

    if (!decision || decision.key !== decisionKey) {
      decision = {
        key: decisionKey,
        promise: resolvePostAuthPath(),
      };
      pendingDecisionRef.current = decision;
      const clearDecision = () => {
        if (pendingDecisionRef.current === decision) {
          pendingDecisionRef.current = null;
        }
      };
      void decision.promise.then(clearDecision, clearDecision);
    }

    const runGuard = async () => {
      const nextPath = await decision.promise;
      if (cancelled) return;

      const isOnboardingRoute = pathname === "/onboarding";
      const isPermissionRoute = pathname === "/app-permissions";
      const allowCompletedEdit =
        search.includes("edit=1") ||
        search.includes("from=settings") ||
        search.includes("from=dashboard");

      if (isOnboardingRoute) {
        if (allowCompletedEdit) return;
        if (!nextPath.startsWith("/onboarding")) {
          navigate(nextPath, { replace: true });
        }
        return;
      }

      if (isPermissionRoute) {
        if (nextPath !== "/app-permissions") {
          navigate(nextPath, { replace: true });
        }
        return;
      }

      // Once setup is complete, the requested authenticated route remains in
      // place. Only mandatory first-run destinations interrupt navigation.
      if (
        nextPath.startsWith("/onboarding") ||
        nextPath === "/app-permissions" ||
        nextPath === "/auth"
      ) {
        navigate(
          nextPath === "/auth" ? "/auth?mode=signin" : nextPath,
          { replace: true },
        );
      }
    };

    runGuard().catch((error) => {
      if (isOnboardingBackendUnavailable(error)) {
        console.warn(
          "Onboarding route guard skipped until the onboarding schema is available:",
          error,
        );
        return;
      }

      console.error("Onboarding route guard failed:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [loading, location, navigate, user]);

  return null;
};
