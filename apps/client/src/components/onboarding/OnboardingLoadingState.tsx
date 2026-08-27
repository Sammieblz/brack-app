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
      className="onboarding-loading min-h-app-viewport bg-gradient-background"
      data-motion={reducedMotion ? "reduced" : "full"}
    >
      <div className="onboarding-loading__shell">
        <header className="onboarding-loading__brand" aria-hidden="true">
          <ThemeAwareLogo variant="icon" size="h-10 w-10" />
          <span>
            <span className="block font-display text-xl font-bold leading-none">Brack</span>
            <span className="block font-sans text-xs text-muted-foreground">Reader setup</span>
          </span>
        </header>

        <section className="onboarding-loading__card">
          <div className="onboarding-loading__book" aria-hidden="true">
            <span className="onboarding-loading__shadow" />
            <span className="onboarding-loading__cover" />
            <span className="onboarding-loading__page onboarding-loading__page--left" />
            <span className="onboarding-loading__page onboarding-loading__page--right" />
            <span className="onboarding-loading__turning-page" />
            <span className="onboarding-loading__bookmark" />
            <span className="onboarding-loading__mark">
              <ThemeAwareLogo variant="icon" size="h-9 w-9" />
            </span>
          </div>

          <div className="max-w-md text-center">
            <p className="onboarding-loading__title font-display font-bold text-foreground">
              Opening your reading room
            </p>
            <p
              className="mt-2 font-sans text-sm text-muted-foreground sm:text-base"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {message}
            </p>
          </div>

          <div className="onboarding-loading__chapters" aria-hidden="true">
            <span />
            <span />
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
