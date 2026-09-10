import { useEffect, useRef, useState } from "react";
import type { ElementType, ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Clock, Palette, Refresh } from "iconoir-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import { OnboardingChapterIndicator, type OnboardingChapter } from "@/components/onboarding/OnboardingChapterIndicator";
import { OnboardingLoadingState, OnboardingRouteTransition } from "@/components/onboarding/OnboardingLoadingState";
import "@/components/onboarding/onboarding.css";
import { ThemePaletteCarousel } from "@/components/ThemePaletteCarousel";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useReadingProfile } from "@/hooks/useReadingProfile";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useToast } from "@/hooks/use-toast";
import { themes } from "@/lib/themes";
import { GENRES } from "@/constants";
import { APP_ICONS } from "@/config/iconography";
import { BRACK_GOALS_IMAGE, BRACK_STREAK_HAPPY_IMAGE, BRACK_TROPHY_IMAGE } from "@/config/brackAssets";
import {
  DEFAULT_ONBOARDING_FORM,
  ONBOARDING_STEPS,
  getOnboardingErrorMessage,
  markOnboardingInProgress,
  normalizeOnboardingFormData,
  saveOnboardingProfile,
  skipOnboarding,
  type OnboardingStepId,
} from "@/services/onboarding";
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  markOnboardingDraftReady,
  saveOnboardingDraftCollection,
} from "@/services/onboardingDraft";
import { markPostSignupPermissionsPending } from "@/services/postSignupPermissions";
import { isMobileNativeRuntime } from "@/services/platform";
import type {
  OnboardingFormData,
  PreferredBookFormat,
  PreferredBookLength,
  PreferredReadingTime,
  ReadingFrequency,
} from "@/types";

type OnboardingTransition = {
  to: string;
  message: string;
};

type StepDirection = -1 | 1;

const STEP_META: Record<OnboardingStepId, { title: string; eyebrow: string; icon: ElementType }> = {
  welcome: {
    title: "Build a profile Brack can learn from",
    eyebrow: "Personalization",
    icon: APP_ICONS.profile.social,
  },
  palette: {
    title: "Choose your Brack palette",
    eyebrow: "App color",
    icon: Palette,
  },
  taste: {
    title: "Tune your reading taste",
    eyebrow: "Reading taste",
    icon: APP_ICONS.profile.booksTab,
  },
  pace: {
    title: "Set your natural rhythm",
    eyebrow: "Reading pace",
    icon: Clock,
  },
  goal: {
    title: "Give your dashboard a target",
    eyebrow: "Goal setup",
    icon: APP_ICONS.dashboard.goal,
  },
  review: {
    title: "Review your reading profile",
    eyebrow: "Ready to save",
    icon: APP_ICONS.dashboard.insights,
  },
};

const STEP_LABELS: Record<OnboardingStepId, string> = {
  welcome: "Welcome",
  palette: "Palette",
  taste: "Taste",
  pace: "Pace",
  goal: "Goal",
  review: "Review",
};

const ONBOARDING_CHAPTERS: readonly OnboardingChapter[] = ONBOARDING_STEPS.map((step) => ({
  id: step,
  label: STEP_LABELS[step],
  eyebrow: STEP_META[step].eyebrow,
  icon: STEP_META[step].icon,
}));

const BOOK_LENGTH_OPTIONS: Array<{
  value: PreferredBookLength;
  label: string;
  description: string;
}> = [
  { value: "short", label: "Short", description: "Under 250 pages" },
  { value: "medium", label: "Medium", description: "250-400 pages" },
  { value: "long", label: "Long", description: "400+ pages" },
  { value: "varied", label: "Varied", description: "Depends on the book" },
];

const READING_TIME_OPTIONS: Array<{
  value: PreferredReadingTime;
  label: string;
}> = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
  { value: "mixed", label: "Mixed" },
];

const FREQUENCY_OPTIONS: Array<{ value: ReadingFrequency; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
  { value: "few_weekly", label: "A few times weekly" },
  { value: "occasional", label: "Occasional" },
];

const FORMAT_OPTIONS: Array<{ value: PreferredBookFormat; label: string }> = [
  { value: "print", label: "Print" },
  { value: "ebook", label: "Ebook" },
  { value: "audio", label: "Audio" },
  { value: "mixed", label: "Mixed" },
];

const INITIAL_GENRE_COUNT = 12;

const numberToInput = (value: number | null) => (value === null ? "" : String(value));

const parseNullableNumber = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const Onboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const { status, loading: statusLoading, refetch: refetchStatus } = useOnboardingStatus(user?.id);
  const { habits, loading: profileLoading, refetch: refetchProfile } = useReadingProfile(user?.id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentTheme, previewTheme, resetToDefaultTheme, resolvedTheme, setTheme } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [stepDirection, setStepDirection] = useState<StepDirection>(1);
  const [formData, setFormData] = useState<OnboardingFormData>(DEFAULT_ONBOARDING_FORM);
  const [saving, setSaving] = useState(false);
  const [transition, setTransition] = useState<OnboardingTransition | null>(null);
  const [completionSeal, setCompletionSeal] = useState(false);
  const [guestDraftHydrated, setGuestDraftHydrated] = useState(false);
  const onboardingExitCommittedRef = useRef(false);
  const hydratedRef = useRef(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const previousStepIndexRef = useRef(stepIndex);
  const stepMotionAllowedRef = useRef(false);
  const reducedMotion = useReducedMotion();

  const currentStep = ONBOARDING_STEPS[stepIndex];
  const isGuestOnboarding = !authLoading && !user;
  const entrySource = searchParams.get("from");
  const shouldResumeDraft = searchParams.get("resume") === "draft";
  const returnPath = entrySource === "settings" ? "/settings" : "/dashboard";
  const isCompletedEdit =
    status?.onboarding_status === "completed" &&
    (searchParams.get("edit") === "1" || entrySource === "settings" || entrySource === "dashboard");

  useEffect(() => {
    if (previousStepIndexRef.current === stepIndex) return;

    previousStepIndexRef.current = stepIndex;
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      pageRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [stepIndex]);

  useEffect(() => {
    setFormData((current) =>
      current.colorTheme === currentTheme ? current : { ...current, colorTheme: currentTheme },
    );
  }, [currentTheme]);

  useEffect(() => {
    if (authLoading || user || guestDraftHydrated) return;

    const draft = loadOnboardingDraft();
    if (draft) {
      setFormData(draft.formData);
      const restoredStep = ONBOARDING_STEPS.indexOf(draft.lastStep);
      if (restoredStep >= 0) setStepIndex(restoredStep);
      previewTheme(draft.formData.colorTheme);
    }
    setGuestDraftHydrated(true);
  }, [authLoading, guestDraftHydrated, previewTheme, user]);

  useEffect(() => {
    if (!isGuestOnboarding || !guestDraftHydrated) return;

    try {
      saveOnboardingDraftCollection({ formData, lastStep: currentStep });
    } catch (error) {
      console.error("Unable to save the local onboarding draft:", error);
    }
  }, [currentStep, formData, guestDraftHydrated, isGuestOnboarding]);

  useEffect(() => {
    if (!user || !shouldResumeDraft || hydratedRef.current) return;

    const draft = loadOnboardingDraft();
    if (!draft?.outcome) return;

    hydratedRef.current = true;
    setFormData(draft.formData);
    setStepIndex(Math.max(0, ONBOARDING_STEPS.indexOf(draft.lastStep)));
    previewTheme(draft.formData.colorTheme);
  }, [previewTheme, shouldResumeDraft, user]);

  useEffect(() => {
    if (
      !user?.id ||
      saving ||
      onboardingExitCommittedRef.current ||
      isCompletedEdit ||
      !status?.onboarding_status ||
      status.onboarding_status === "completed" ||
      status.onboarding_status === "skipped"
    ) {
      return;
    }

    markOnboardingInProgress(user.id, currentStep).catch((err) => {
      console.error("Failed to mark onboarding progress:", err);
    });
  }, [currentStep, isCompletedEdit, saving, status?.onboarding_status, user?.id]);

  useEffect(() => {
    if (hydratedRef.current || profileLoading || !habits) return;

    hydratedRef.current = true;
    setFormData((current) => ({
      ...current,
      favoriteGenres: habits.genres ?? current.favoriteGenres,
      slowestGenre: habits.longest_genre ?? current.slowestGenre,
      booksReadSixMonths: habits.books_6mo ?? current.booksReadSixMonths,
      booksReadYear: habits.books_1yr ?? current.booksReadYear,
      averageDaysPerBook: habits.avg_time_per_book ?? current.averageDaysPerBook,
      preferredSessionMinutes: habits.preferred_session_minutes ?? current.preferredSessionMinutes,
      preferredReadingTime:
        (habits.preferred_reading_time as PreferredReadingTime | null) ?? current.preferredReadingTime,
      readingFrequency: (habits.reading_frequency as ReadingFrequency | null) ?? current.readingFrequency,
      motivation: habits.motivation ?? current.motivation,
      preferredBookFormat: (habits.book_format as PreferredBookFormat | null) ?? current.preferredBookFormat,
    }));
  }, [habits, profileLoading]);

  if (transition) {
    return <OnboardingRouteTransition to={transition.to} message={transition.message} minDisplayTime={950} />;
  }

  if (
    authLoading ||
    (Boolean(user) && (statusLoading || profileLoading)) ||
    (isGuestOnboarding && !guestDraftHydrated)
  ) {
    return <OnboardingLoadingState />;
  }

  const updateField = <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const setNumberField = (key: keyof OnboardingFormData, value: string) => {
    setFormData((current) => ({
      ...current,
      [key]: parseNullableNumber(value),
    }));
  };

  const toggleGenre = (genre: string) => {
    setFormData((current) => ({
      ...current,
      favoriteGenres: current.favoriteGenres.includes(genre)
        ? current.favoriteGenres.filter((item) => item !== genre)
        : [...current.favoriteGenres, genre],
    }));
  };

  const handlePaletteSelect = async (themeId: string) => {
    try {
      updateField("colorTheme", themeId);
      if (user) {
        await setTheme(themeId);
      } else {
        previewTheme(themeId);
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not save palette",
        description: getOnboardingErrorMessage(err, "Your previous palette is still active."),
      });
    }
  };

  const handleNext = () => {
    if (stepIndex < ONBOARDING_STEPS.length - 1) {
      setStepDirection(1);
      setStepIndex((index) => index + 1);
      return;
    }

    void handleComplete();
  };

  const handleExitToHome = () => {
    if (!user) {
      clearOnboardingDraft();
      resetToDefaultTheme();
    }
    navigate("/", { replace: false });
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepDirection(-1);
      setStepIndex((index) => index - 1);
      return;
    }

    handleExitToHome();
  };

  const handleSkip = async () => {
    try {
      setSaving(true);

      if (!user) {
        saveOnboardingDraftCollection({ formData, lastStep: currentStep });
        const draft = markOnboardingDraftReady({
          outcome: "skipped",
          lastStep: currentStep,
        });
        if (!draft) throw new Error("Brack could not preserve this setup before sign-up.");
        setTransition({
          to: "/auth?mode=signup&from=onboarding",
          message: "Opening secure sign-up…",
        });
        return;
      }

      if (!isCompletedEdit) {
        await skipOnboarding(user.id, currentStep);
        onboardingExitCommittedRef.current = true;
        await Promise.all([refetchStatus(), refetchProfile()]);
      }

      const destination = !isCompletedEdit && isMobileNativeRuntime() ? "/app-permissions" : returnPath;
      if (!isCompletedEdit && isMobileNativeRuntime()) {
        markPostSignupPermissionsPending(user.id);
      }
      if (shouldResumeDraft) clearOnboardingDraft();
      navigate(destination, { replace: true });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Could not skip setup",
        description: getOnboardingErrorMessage(err, "Please try again."),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    try {
      setSaving(true);
      const { normalized } = normalizeOnboardingFormData(formData);

      if (!user) {
        saveOnboardingDraftCollection({
          formData: normalized,
          lastStep: "review",
        });
        const draft = markOnboardingDraftReady({
          outcome: "completed",
          lastStep: "review",
        });
        if (!draft) throw new Error("Brack could not preserve this setup before sign-up.");

        if (!reducedMotion) {
          setCompletionSeal(true);
          window.setTimeout(() => {
            setTransition({
              to: "/auth?mode=signup&from=onboarding",
              message: "Your reading profile is ready. Opening secure sign-up…",
            });
          }, 520);
        } else {
          setTransition({
            to: "/auth?mode=signup&from=onboarding",
            message: "Your reading profile is ready. Opening secure sign-up…",
          });
        }
        return;
      }

      const resumedDraft = shouldResumeDraft ? loadOnboardingDraft() : null;
      await saveOnboardingProfile(user.id, normalized, {
        goalId: resumedDraft?.flowId,
      });
      onboardingExitCommittedRef.current = true;
      await Promise.all([refetchStatus(), refetchProfile()]);

      if (resumedDraft) clearOnboardingDraft();
      const destination = !isCompletedEdit && isMobileNativeRuntime() ? "/app-permissions" : returnPath;
      if (!isCompletedEdit && isMobileNativeRuntime()) {
        markPostSignupPermissionsPending(user.id);
      }

      if (!reducedMotion) {
        setCompletionSeal(true);
        window.setTimeout(() => {
          setTransition({
            to: destination,
            message:
              destination === "/app-permissions"
                ? "Your profile is ready. One last device choice…"
                : "Personalizing your dashboard…",
          });
        }, 520);
      } else {
        setTransition({
          to: destination,
          message:
            destination === "/app-permissions"
              ? "Your profile is ready. One last device choice…"
              : "Personalizing your dashboard…",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Finish setup needs a little more",
        description: getOnboardingErrorMessage(err, "Check your answers and try again."),
      });
    } finally {
      setSaving(false);
    }
  };

  const selectStep = (step: OnboardingStepId) => {
    const nextIndex = ONBOARDING_STEPS.indexOf(step);
    if (nextIndex >= 0) {
      setStepDirection(nextIndex < stepIndex ? -1 : 1);
      setStepIndex(nextIndex);
    }
  };

  const shouldAnimateStep = !reducedMotion && stepMotionAllowedRef.current;

  return (
    <div
      className="onboarding-root bg-background text-foreground"
      onPointerDownCapture={() => {
        stepMotionAllowedRef.current = true;
      }}
      onKeyDownCapture={() => {
        stepMotionAllowedRef.current = false;
      }}
    >
      {completionSeal && (
        <div className="onboarding-completion" aria-hidden="true">
          <span className="onboarding-completion__rule" />
          <span className="onboarding-completion__seal">
            <Check className="h-6 w-6" />
          </span>
        </div>
      )}

      <div className="onboarding-frame mx-auto flex h-full w-full max-w-7xl flex-col">
        <header className="onboarding-logo flex shrink-0 items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleExitToHome}
            className="onboarding-home-control flex min-h-11 items-center px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Return to Brack home"
          >
            <ThemeAwareLogo variant="full" size="h-8 sm:h-9" />
          </button>

          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={saving}
            className="onboarding-button onboarding-button--quiet min-h-11 shrink-0 px-3 sm:px-4"
          >
            <span className="sm:hidden">{isCompletedEdit ? "Close" : "Skip"}</span>
            <span className="hidden sm:inline">
              {isCompletedEdit ? "Close" : isGuestOnboarding ? "Skip to sign up" : "Skip for now"}
            </span>
          </Button>
        </header>

        <main className="onboarding-shell min-h-0 flex-1">
          <section className="onboarding-folio mx-auto grid h-full w-full max-w-6xl overflow-hidden border-y border-border bg-card">
            <aside className="onboarding-chapter-dock min-w-0 border-b border-border">
              <OnboardingChapterIndicator
                chapters={ONBOARDING_CHAPTERS}
                currentStep={currentStep}
                disabled={saving}
                onStepSelect={selectStep}
              />
            </aside>

            <div className="onboarding-reader flex min-h-0 min-w-0 flex-col">
              <div
                ref={contentScrollRef}
                className="onboarding-content-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
              >
                <motion.div
                  key={currentStep}
                  ref={pageRef}
                  className="onboarding-page min-h-full focus:outline-none"
                  role="region"
                  aria-label={`${STEP_LABELS[currentStep]} onboarding chapter`}
                  tabIndex={-1}
                  data-motion={shouldAnimateStep ? "directional" : "instant"}
                  initial={shouldAnimateStep ? { opacity: 0, x: stepDirection * 18 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: shouldAnimateStep ? 0.24 : 0,
                    ease: [0.25, 1, 0.5, 1],
                  }}
                >
                  {currentStep === "welcome" && (
                    <WelcomeStep
                      userName={
                        (user?.user_metadata as Record<string, string | undefined> | undefined)?.first_name ||
                        user?.email?.split("@")[0]
                      }
                    />
                  )}

                  {currentStep === "taste" && (
                    <TasteStep formData={formData} onToggleGenre={toggleGenre} onFieldChange={updateField} />
                  )}

                  {currentStep === "palette" && (
                    <PaletteStep
                      selectedTheme={currentTheme}
                      previewMode={resolvedTheme === "dark" ? "dark" : "light"}
                      onSelectTheme={handlePaletteSelect}
                    />
                  )}

                  {currentStep === "pace" && (
                    <PaceStep formData={formData} onFieldChange={updateField} onNumberFieldChange={setNumberField} />
                  )}

                  {currentStep === "goal" && (
                    <GoalStep formData={formData} onFieldChange={updateField} onNumberFieldChange={setNumberField} />
                  )}

                  {currentStep === "review" && <ReviewStep formData={formData} isPreAuth={isGuestOnboarding} />}
                </motion.div>
              </div>

              <div className="onboarding-action-dock flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={saving}
                  className="onboarding-button onboarding-button--secondary min-h-11 shrink-0 px-4"
                  aria-label={stepIndex === 0 ? "Return to Brack home" : "Go back one onboarding chapter"}
                >
                  {stepIndex === 0 ? "Home" : "Back"}
                </Button>

                <Button
                  onClick={handleNext}
                  disabled={saving}
                  className="onboarding-button onboarding-button--primary min-h-11 min-w-0 flex-1 px-5 sm:min-w-[10rem] sm:flex-none"
                >
                  {saving ? (
                    <>
                      <Refresh className="mr-2 h-4 w-4 animate-spin" />
                      Saving
                    </>
                  ) : stepIndex === ONBOARDING_STEPS.length - 1 ? (
                    isGuestOnboarding ? (
                      <>
                        <span className="hidden min-[360px]:inline">Continue to sign up</span>
                        <span className="min-[360px]:hidden">Sign up</span>
                      </>
                    ) : (
                      "Finish setup"
                    )
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

const OnboardingStepIntro = ({
  step,
  title,
  description,
}: {
  step: OnboardingStepId;
  title?: ReactNode;
  description: ReactNode;
}) => {
  const stepNumber = ONBOARDING_STEPS.indexOf(step) + 1;

  return (
    <header className="onboarding-step-intro">
      <p className="onboarding-step-intro__eyebrow">
        <span>{String(stepNumber).padStart(2, "0")}</span>
        {STEP_META[step].eyebrow}
      </p>
      <h1 className="onboarding-step-intro__title">{title ?? STEP_META[step].title}</h1>
      <p className="onboarding-step-intro__description">{description}</p>
    </header>
  );
};

const WelcomeStep = ({ userName }: { userName?: string }) => (
  <div className="onboarding-step-layout onboarding-step-layout--welcome">
    <div className="min-w-0">
      <OnboardingStepIntro
        step="welcome"
        title={
          userName
            ? `${userName}, make Brack feel like it already knows your library.`
            : "Make Brack feel like it already knows your library."
        }
        description="A few thoughtful choices shape your goals, recommendations, and daily reading rhythm. You can change everything later in Settings."
      />

      <ol className="onboarding-primer-list">
        {[
          ["Make it yours", "Choose a palette and the books you love."],
          ["Find your rhythm", "Set a pace that fits your real life."],
          ["Read with direction", "Give your dashboard a useful first goal."],
        ].map(([title, body], index) => (
          <li key={title} className="onboarding-primer-list__item">
            <span className="onboarding-primer-list__number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>
              <span className="onboarding-primer-list__title">{title}</span>
              <span className="onboarding-primer-list__body">{body}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>

    <aside className="onboarding-aside onboarding-welcome-aside">
      <div className="streak-art-stage mx-auto w-[clamp(7rem,28vw,11rem)]" aria-hidden="true">
        <span className="streak-art-aura" />
        <span className="streak-art-shadow" />
        <img
          src={BRACK_STREAK_HAPPY_IMAGE}
          alt=""
          className="onboarding-floating-art aspect-square w-full object-contain"
          decoding="async"
        />
      </div>
      <p className="onboarding-aside__caption">A profile built from your reading signals, not a generic checklist.</p>
    </aside>
  </div>
);

const PaletteStep = ({
  selectedTheme,
  previewMode,
  onSelectTheme,
}: {
  selectedTheme: string;
  previewMode: "light" | "dark";
  onSelectTheme: (themeId: string) => Promise<void>;
}) => (
  <div className="onboarding-step-layout">
    <div className="min-w-0 space-y-5">
      <OnboardingStepIntro
        step="palette"
        title="Pick the palette Brack should remember"
        description="Preview the app in a color that feels like yours. You can change it later in Settings."
      />

      <ThemePaletteCarousel
        selectedTheme={selectedTheme}
        previewMode={previewMode}
        onSelectTheme={onSelectTheme}
        ariaLabel="Onboarding theme palette options"
      />
    </div>

    <aside className="onboarding-aside hidden lg:block">
      <div className="onboarding-aside__heading">
        <Palette className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-semibold">Live preview</h3>
      </div>
      <div className="onboarding-palette-preview">
        <div className="flex items-center gap-3">
          <ThemeAwareLogo variant="icon" size="h-10 w-10" />
          <div>
            <p className="font-display text-xl font-bold">Brack</p>
            <p className="font-sans text-xs text-muted-foreground">Your palette follows you.</p>
          </div>
        </div>
        <div className="onboarding-preview-meter" aria-hidden="true">
          <span data-complete="true" />
          <span data-complete="true" />
          <span />
        </div>
        <div className="grid grid-cols-2 border-y border-border">
          <div className="border-r border-border py-3 pr-3">
            <p className="font-sans text-xs text-muted-foreground">Goal</p>
            <p className="font-sans text-lg font-bold text-primary">12</p>
          </div>
          <div className="py-3 pl-3">
            <p className="font-sans text-xs text-muted-foreground">Streak</p>
            <p className="font-sans text-lg font-bold text-primary">3</p>
          </div>
        </div>
      </div>
      <p className="mt-3 font-sans text-xs text-muted-foreground">
        Public pages stay on Brack's default palette. This palette starts after you choose it.
      </p>
    </aside>
  </div>
);

interface TasteStepProps {
  formData: OnboardingFormData;
  onToggleGenre: (genre: string) => void;
  onFieldChange: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
}

const TasteStep = ({ formData, onToggleGenre, onFieldChange }: TasteStepProps) => {
  const [showAllGenres, setShowAllGenres] = useState(false);
  const collapsedGenres = GENRES.filter(
    (genre, index) => index < INITIAL_GENRE_COUNT || formData.favoriteGenres.includes(genre),
  );
  const visibleGenres = showAllGenres ? GENRES : collapsedGenres;
  const hiddenGenreCount = Math.max(0, GENRES.length - collapsedGenres.length);

  return (
    <div className="onboarding-step-layout onboarding-step-layout--wide-aside">
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <OnboardingStepIntro
          step="taste"
          title="Choose the genres Brack should learn first"
          description="Pick at least one. These become search chips, reader matching signals, and recommendation context."
        />

        <div id="onboarding-genre-options" className="flex flex-wrap gap-2" role="group" aria-label="Favorite genres">
          {visibleGenres.map((genre) => {
            const selected = formData.favoriteGenres.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => onToggleGenre(genre)}
                aria-pressed={selected}
                data-selected={selected}
                className="onboarding-choice onboarding-genre-choice min-h-11 rounded-full border px-3 py-2 font-sans text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {genre}
              </button>
            );
          })}
        </div>

        <div className="onboarding-selection-status flex min-h-11 flex-wrap items-center justify-between gap-2 border-y border-border py-2">
          <p className="font-sans text-sm text-muted-foreground" aria-live="polite">
            <span className="font-semibold text-foreground">{formData.favoriteGenres.length}</span>{" "}
            {formData.favoriteGenres.length === 1 ? "genre" : "genres"} selected
          </p>
          {hiddenGenreCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="onboarding-button onboarding-button--quiet min-h-11 px-2 text-primary"
              aria-expanded={showAllGenres}
              aria-controls="onboarding-genre-options"
              onClick={() => setShowAllGenres((current) => !current)}
            >
              {showAllGenres ? "Show fewer genres" : `Show ${hiddenGenreCount} more`}
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="slowestGenre">Slowest genre</Label>
            <Select value={formData.slowestGenre} onValueChange={(value) => onFieldChange("slowestGenre", value)}>
              <SelectTrigger id="slowestGenre" className="min-h-11">
                <SelectValue placeholder="Select a genre" />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    {genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="space-y-2">
            <legend className="font-sans text-sm font-medium leading-none text-foreground">
              Preferred book length
            </legend>
            <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              {BOOK_LENGTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onFieldChange("preferredBookLength", option.value)}
                  aria-pressed={formData.preferredBookLength === option.value}
                  data-selected={formData.preferredBookLength === option.value}
                  className="onboarding-choice min-h-11 rounded-md border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="block font-sans text-sm font-semibold">{option.label}</span>
                  <span className="block font-sans text-xs text-muted-foreground">{option.description}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <aside className="onboarding-aside hidden xl:block">
        <div className="onboarding-aside__heading">
          <h3 className="font-display text-lg font-semibold">Selected genres</h3>
        </div>
        <div className="flex min-h-20 flex-wrap content-start gap-2">
          {formData.favoriteGenres.length === 0 ? (
            <p className="font-sans text-sm text-muted-foreground">Your choices will collect here.</p>
          ) : (
            formData.favoriteGenres.map((genre) => (
              <Badge key={genre} className="selected-genre-chip">
                {genre}
              </Badge>
            ))
          )}
        </div>
      </aside>
    </div>
  );
};

interface PaceStepProps {
  formData: OnboardingFormData;
  onFieldChange: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onNumberFieldChange: (key: keyof OnboardingFormData, value: string) => void;
}

const PaceStep = ({ formData, onFieldChange, onNumberFieldChange }: PaceStepProps) => (
  <div className="space-y-6">
    <OnboardingStepIntro
      step="pace"
      title="Tell Brack how reading fits your real life"
      description="These fields are optional, but they make goal suggestions and streak nudges less generic."
    />

    <section className="onboarding-form-section" aria-labelledby="onboarding-recent-pace">
      <h2 id="onboarding-recent-pace" className="onboarding-form-section__title">
        Recent pace
      </h2>
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <NumberField
          id="books6mo"
          label="Books in 6 months"
          value={numberToInput(formData.booksReadSixMonths)}
          onChange={(value) => onNumberFieldChange("booksReadSixMonths", value)}
          placeholder="6"
        />
        <NumberField
          id="books1yr"
          label="Books in 1 year"
          value={numberToInput(formData.booksReadYear)}
          onChange={(value) => onNumberFieldChange("booksReadYear", value)}
          placeholder="12"
        />
        <NumberField
          id="avgDays"
          label="Average days/book"
          value={numberToInput(formData.averageDaysPerBook)}
          onChange={(value) => onNumberFieldChange("averageDaysPerBook", value)}
          placeholder="21"
        />
        <NumberField
          id="sessionLength"
          label="Session minutes"
          value={numberToInput(formData.preferredSessionMinutes)}
          onChange={(value) => onNumberFieldChange("preferredSessionMinutes", value)}
          placeholder="20"
        />
      </div>
    </section>

    <section className="onboarding-form-section grid gap-5 md:grid-cols-3" aria-label="Reading preferences">
      <OptionGrid
        label="Preferred time"
        value={formData.preferredReadingTime}
        options={READING_TIME_OPTIONS}
        onChange={(value) => onFieldChange("preferredReadingTime", value as PreferredReadingTime)}
      />
      <OptionGrid
        label="Frequency"
        value={formData.readingFrequency}
        options={FREQUENCY_OPTIONS}
        onChange={(value) => onFieldChange("readingFrequency", value as ReadingFrequency)}
      />
      <OptionGrid
        label="Format"
        value={formData.preferredBookFormat}
        options={FORMAT_OPTIONS}
        onChange={(value) => onFieldChange("preferredBookFormat", value as PreferredBookFormat)}
      />
    </section>

    <div className="onboarding-form-section space-y-2">
      <Label htmlFor="motivation">What are you reading toward?</Label>
      <Input
        id="motivation"
        className="min-h-11"
        value={formData.motivation}
        onChange={(event) => onFieldChange("motivation", event.target.value)}
        placeholder="Learning, focus, joy, school, career, community..."
      />
    </div>
  </div>
);

interface GoalStepProps {
  formData: OnboardingFormData;
  onFieldChange: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onNumberFieldChange: (key: keyof OnboardingFormData, value: string) => void;
}

const GoalStep = ({ formData, onFieldChange, onNumberFieldChange }: GoalStepProps) => (
  <div className="onboarding-step-layout onboarding-step-layout--wide-aside">
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <OnboardingStepIntro
        step="goal"
        title="Set a first target"
        description="Brack uses this for dashboard progress, analytics targets, and smarter empty states."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <NumberField
          id="targetBooks"
          label="Target books"
          value={numberToInput(formData.goalTargetBooks)}
          onChange={(value) => onNumberFieldChange("goalTargetBooks", value)}
          placeholder="12"
          required
        />
        <DatePicker
          id="goalStart"
          label="Start date"
          value={formData.goalStartDate}
          onChange={(value) => onFieldChange("goalStartDate", value)}
        />
        <DatePicker
          id="goalEnd"
          label="End date"
          value={formData.goalEndDate}
          onChange={(value) => onFieldChange("goalEndDate", value)}
        />
      </div>

      <div className="onboarding-reminder-row border-y border-border py-4">
        <div className="flex items-start justify-between gap-4">
          <Label htmlFor="onboarding-reminder" className="min-h-11 min-w-0 flex-1 cursor-pointer py-1">
            <span className="block font-sans text-base font-medium text-foreground">Daily reminder</span>
            <p className="font-sans text-sm text-muted-foreground">
              This seeds notification preferences; you can edit it later.
            </p>
          </Label>
          <Switch
            id="onboarding-reminder"
            checked={formData.reminderEnabled}
            onCheckedChange={(checked) => onFieldChange("reminderEnabled", checked)}
            aria-label="Enable daily reading reminder"
            className="mt-1 shrink-0"
          />
        </div>
        {formData.reminderEnabled && (
          <div className="mt-4 max-w-xs space-y-2">
            <TimePicker
              id="reminderTime"
              label="Reminder time"
              value={formData.reminderTime ?? "19:00"}
              onChange={(value) => onFieldChange("reminderTime", value)}
            />
          </div>
        )}
      </div>
    </div>

    <aside className="onboarding-aside hidden text-center lg:block">
      <img
        src={BRACK_GOALS_IMAGE}
        alt=""
        aria-hidden="true"
        className="onboarding-floating-art mx-auto mb-4 h-36 w-36 object-contain"
        decoding="async"
      />
      <div className="font-sans text-sm text-muted-foreground">Current target</div>
      <div className="font-display text-5xl font-bold text-primary">
        <span>{formData.goalTargetBooks ?? 0}</span>
      </div>
      <div className="font-sans text-sm text-muted-foreground">books</div>
    </aside>
  </div>
);

const ReviewStep = ({ formData, isPreAuth = false }: { formData: OnboardingFormData; isPreAuth?: boolean }) => (
  <div className="onboarding-step-layout">
    <div className="min-w-0 space-y-5">
      <OnboardingStepIntro
        step="review"
        title="This is the starting profile Brack will use"
        description={
          isPreAuth
            ? "Your choices stay only in this open setup. Refreshing or closing it starts over; after verification Brack applies them to your profile."
            : "You can edit this from Settings later. Completing now removes the dashboard setup prompt."
        }
      />

      <div className="onboarding-summary-ledger">
        <SummaryRow index="01" title="Taste">
          <div className="flex flex-wrap gap-2">
            {formData.favoriteGenres.length > 0 ? (
              formData.favoriteGenres.map((genre) => (
                <Badge key={genre} variant="secondary">
                  {genre}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">No genres selected</span>
            )}
          </div>
        </SummaryRow>

        <SummaryRow index="02" title="Palette">
          <p>{themes.find((theme) => theme.id === formData.colorTheme)?.name ?? "Warm Sunset"}</p>
          <p className="text-muted-foreground">
            {isPreAuth ? "Applied after secure sign-up" : "Saved to your app appearance"}
          </p>
        </SummaryRow>

        <SummaryRow index="03" title="Pace">
          <p>{formData.preferredSessionMinutes ?? "No"} min sessions</p>
          <p className="text-muted-foreground">
            {formData.readingFrequency || "No cadence"} · {formData.preferredReadingTime || "No time set"}
          </p>
        </SummaryRow>

        <SummaryRow index="04" title="Goal">
          <p>{formData.goalTargetBooks ?? 0} books</p>
          <p className="text-muted-foreground">
            {formData.reminderEnabled ? `Reminder at ${formData.reminderTime}` : "No reminder"}
          </p>
        </SummaryRow>

        <SummaryRow index="05" title="Learning signals">
          <p>{formData.preferredBookLength || "Any"} length</p>
          <p className="text-muted-foreground">{formData.preferredBookFormat || "Any"} format</p>
        </SummaryRow>
      </div>
    </div>

    <aside className="onboarding-aside hidden text-center lg:block">
      <img
        src={BRACK_TROPHY_IMAGE}
        alt=""
        aria-hidden="true"
        className="onboarding-floating-art mx-auto mb-4 h-36 w-36 object-contain"
        decoding="async"
      />
      <p className="font-display text-xl font-bold">Ready to personalize</p>
      <p className="font-sans text-sm text-muted-foreground">
        {isPreAuth
          ? "Next, create your account. Brack applies these choices only after verification."
          : "Habits, goal, notification preference, and learning signals will be saved together."}
      </p>
    </aside>
  </div>
);

const NumberField = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      className="min-h-11"
      type="number"
      min={required ? 1 : 0}
      inputMode="numeric"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required={required}
    />
  </div>
);

const OptionGrid = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) => (
  <fieldset className="space-y-2">
    <legend className="font-sans text-sm font-medium leading-none text-foreground">{label}</legend>
    <div className="onboarding-option-grid grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          data-selected={value === option.value}
          className="onboarding-choice min-h-11 rounded-md border px-3 py-2 text-left font-sans text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {option.label}
        </button>
      ))}
    </div>
  </fieldset>
);

const SummaryRow = ({ index, title, children }: { index: string; title: string; children: ReactNode }) => (
  <div className="onboarding-summary-row">
    <span className="onboarding-summary-row__index" aria-hidden="true">
      {index}
    </span>
    <h3 className="onboarding-summary-row__title">{title}</h3>
    <div className="onboarding-summary-row__value">{children}</div>
  </div>
);

export default Onboarding;
