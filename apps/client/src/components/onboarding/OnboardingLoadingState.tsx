import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface OnboardingLoadingStateProps {
  message?: string;
}

export const OnboardingLoadingState = ({
  message = "Preparing your reading profile…",
}: OnboardingLoadingStateProps) => {
  const reducedMotion = useReducedMotion();

  return (
    <main
      className="onboarding-loading min-h-app-viewport bg-background"
      data-motion={reducedMotion ? "reduced" : "full"}
    >
      <div className="onboarding-loading__shell">
        <header className="onboarding-loading__brand" aria-hidden="true">
          <ThemeAwareLogo variant="full" size="h-9" />
        </header>

        <section className="onboarding-loading__folio">
          <div className="onboarding-loading__register" aria-hidden="true">
            <ThemeAwareLogo variant="icon" size="h-12 w-12" />
            <span className="onboarding-loading__register-line onboarding-loading__register-line--long" />
            <span className="onboarding-loading__register-line" />
            <span className="onboarding-loading__register-line onboarding-loading__register-line--short" />
          </div>

          <div className="onboarding-loading__copy">
            <p className="onboarding-loading__eyebrow">Reader setup</p>
            <h1 className="onboarding-loading__title font-display font-bold text-foreground">
              Opening your reading room
            </h1>
            <p
              className="mt-2 font-sans text-sm text-muted-foreground sm:text-base"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {message}
            </p>
          </div>

          <div className="onboarding-loading__trace" aria-hidden="true">
            <span />
          </div>
        </section>
      </div>
    </main>
  );
};

interface OnboardingRouteTransitionProps {
  to: string;
  message: string;
  replace?: boolean;
  minDisplayTime?: number;
}

export const OnboardingRouteTransition = ({
  to,
  message,
  replace = true,
  minDisplayTime = 900,
}: OnboardingRouteTransitionProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate(to, { replace });
    }, Math.max(0, minDisplayTime));

    return () => window.clearTimeout(timer);
  }, [minDisplayTime, navigate, replace, to]);

  return <OnboardingLoadingState message={message} />;
};
