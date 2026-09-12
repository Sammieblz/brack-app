import { Navigate } from "react-router-dom";

import { BrackLoader } from "@/components/animations/LogoSpinner";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";

interface OnboardingLoadingStateProps {
  message?: string;
}

export const OnboardingLoadingState = ({
  message = "Preparing your reading profile…",
}: OnboardingLoadingStateProps) => (
  <main className="onboarding-loading min-h-app-viewport bg-background">
    <div className="onboarding-loading__shell">
      <header className="onboarding-loading__brand" aria-hidden="true">
        <ThemeAwareLogo variant="full" size="h-9" />
      </header>

      <section className="onboarding-loading__folio">
        <BrackLoader
          variant="section"
          size="lg"
          label={message}
          className="onboarding-loading__book"
        />

        <div className="onboarding-loading__copy">
          <p className="onboarding-loading__eyebrow">Reader setup</p>
          <h1 className="onboarding-loading__title font-display font-bold text-foreground">
            Opening your reading room
          </h1>
        </div>
      </section>
    </div>
  </main>
);

interface OnboardingRouteTransitionProps {
  to: string;
  message: string;
  replace?: boolean;
}

export const OnboardingRouteTransition = ({
  to,
  replace = true,
}: OnboardingRouteTransitionProps) => <Navigate to={to} replace={replace} />;
