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
import { BrandedLoadingScreen } from "@/components/animations/BrandedLoadingScreen";
import { OnboardingReadingPractice } from "@/components/onboarding/OnboardingReadingPractice";
import {
  getBookFormatLabel,
  getBookLengthLabel,
  getDefaultGoalDates,
  getGoalPaceSummary,
  getGoalValidationMessage,
  getReadingRhythmSummary,
  getSessionValidationMessage,
  getTasteSummary,
} from "@/components/onboarding/onboardingPresentation";
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
import { BRACK_GOALS_IMAGE, BRACK_TROPHY_IMAGE } from "@/config/brackAssets";
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
    title: "A little reading adds up",
    eyebrow: "Your reading life",
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
    title: "A goal that fits your life",
    eyebrow: "Your first goal",
    icon: APP_ICONS.dashboard.goal,
  },
  review: {
    title: "Your next chapter starts here",
    eyebrow: "Your starting plan",
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
const MAX_SELECTED_GENRES = 12;
const NEXT_STEP_LABELS: Record<OnboardingStepId, string> = {
  welcome: "Make Brack yours",
  palette: "Choose reading taste",
  taste: "Find your rhythm",
  pace: "Set your first goal",
  goal: "Review your plan",
  review: "Continue to sign up",
};

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
  const [formData, setFormData] = useState<OnboardingFormData>(() => ({
    ...DEFAULT_ONBOARDING_FORM,
    ...getDefaultGoalDates(),
  }));
  const [editingFromReview, setEditingFromReview] = useState(false);
  const [validationStep, setValidationStep] = useState<OnboardingStepId | null>(null);
  const [goalStartValid, setGoalStartValid] = useState(true);
  const [goalEndValid, setGoalEndValid] = useState(true);
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
      setFormData({
        ...draft.formData,
        goalStartDate: draft.formData.goalStartDate ?? getDefaultGoalDates().goalStartDate,
        goalEndDate: draft.formData.goalEndDate ?? getDefaultGoalDates().goalEndDate,
      });
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
    return <OnboardingRouteTransition to={transition.to} message={transition.message} />;
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
        : current.favoriteGenres.length < MAX_SELECTED_GENRES
          ? [...current.favoriteGenres, genre]
          : current.favoriteGenres,
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
    if (
      (currentStep === "taste" && formData.favoriteGenres.length === 0) ||
      (currentStep === "pace" && getSessionValidationMessage(formData.preferredSessionMinutes)) ||
      (currentStep === "goal" && (!goalStartValid || !goalEndValid || getGoalValidationMessage(formData)))
    ) {
      setValidationStep(currentStep);
      // The action dock stays visible while long chapters scroll. Bring the
      // actual problem back into view instead of appearing to ignore Next.
      window.requestAnimationFrame(() => {
        const selector = currentStep === "taste"
          ? "#onboarding-genre-options button"
          : currentStep === "pace"
            ? "#sessionLength"
            : !formData.goalTargetBooks || !Number.isInteger(formData.goalTargetBooks) || formData.goalTargetBooks < 1 || formData.goalTargetBooks > 365
              ? "#targetBooks"
              : !goalStartValid || !formData.goalStartDate ? "#goalStart" : "#goalEnd";
        const invalidControl = pageRef.current?.querySelector<HTMLElement>(selector);
        invalidControl?.focus({ preventScroll: true });
        invalidControl?.scrollIntoView({ block: "center", behavior: "instant" });
      });
      return;
    }
    setValidationStep(null);
    if (editingFromReview) {
      setEditingFromReview(false);
      setStepDirection(1);
      setStepIndex(ONBOARDING_STEPS.indexOf("review"));
      return;
    }
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
    setEditingFromReview(false);
    setValidationStep(null);
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
    const invalidStep = formData.favoriteGenres.length === 0
      ? "taste"
      : getSessionValidationMessage(formData.preferredSessionMinutes)
        ? "pace"
        : !goalStartValid || !goalEndValid || getGoalValidationMessage(formData) ? "goal" : null;
    if (invalidStep) {
      selectStep(invalidStep, true);
      setValidationStep(invalidStep);
      return;
    }
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

  const selectStep = (step: OnboardingStepId, fromReview = false) => {
    const nextIndex = ONBOARDING_STEPS.indexOf(step);
    if (nextIndex >= 0) {
      setEditingFromReview(fromReview);
      setValidationStep(null);
      setStepDirection(nextIndex < stepIndex ? -1 : 1);
      setStepIndex(nextIndex);
    }
  };

  const shouldAnimateStep = !reducedMotion && stepMotionAllowedRef.current;

  return (
    <div
      className="onboarding-root bg-background text-foreground"
      onPointerDownCapture={(event) => {
        stepMotionAllowedRef.current = true;
        event.currentTarget.dataset.input = "pointer";
      }}
      onKeyDownCapture={(event) => {
        stepMotionAllowedRef.current = false;
        event.currentTarget.dataset.input = "keyboard";
      }}
    >
      <BrandedLoadingScreen
        active={saving}
        message={isGuestOnboarding ? "Preparing secure sign-up..." : "Saving your reading profile..."}
      />

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
                    <TasteStep formData={formData} onToggleGenre={toggleGenre} onFieldChange={updateField} showValidation={validationStep === "taste"} />
                  )}

                  {currentStep === "palette" && (
                    <PaletteStep
                      selectedTheme={currentTheme}
                      previewMode={resolvedTheme === "dark" ? "dark" : "light"}
                      onSelectTheme={handlePaletteSelect}
                    />
                  )}

                  {currentStep === "pace" && (
                    <PaceStep formData={formData} onFieldChange={updateField} onNumberFieldChange={setNumberField} showValidation={validationStep === "pace"} />
                  )}

                  {currentStep === "goal" && (
                    <GoalStep
                      formData={formData}
                      onFieldChange={updateField}
                      onNumberFieldChange={setNumberField}
                      showValidation={validationStep === "goal"}
                      onStartValidityChange={setGoalStartValid}
                      onEndValidityChange={setGoalEndValid}
                    />
                  )}

                  {currentStep === "review" && <ReviewStep formData={formData} isPreAuth={isGuestOnboarding} onEdit={(step) => selectStep(step, true)} />}
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
                  className="onboarding-button onboarding-button--primary min-h-11 min-w-0 flex-1 px-5 sm:flex-initial"
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
                    editingFromReview ? "Back to review" : NEXT_STEP_LABELS[currentStep]
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
            ? `${userName}, a little reading adds up.`
            : "A little reading adds up."
        }
        description="Keep your place, find a rhythm, and see your reading become a record. Start with a few choices that feel like you; everything can change later."
      />

      <ol className="onboarding-primer-list">
        {[
          ["Pick up where you left off", "Keep your current page close at hand."],
          ["Make room for reading", "Choose a rhythm that fits your day."],
          ["Watch it add up", "Pages, minutes, and finished books tell your story."],
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

    <aside className="onboarding-aside">
      <OnboardingReadingPractice />
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
        title="Make yourself at home"
        description="Choose a palette for your reading life. Try a few; your choice carries into sign-up and can change later in Settings."
      />

      <ThemePaletteCarousel
        selectedTheme={selectedTheme}
        previewMode={previewMode}
        onSelectTheme={onSelectTheme}
        ariaLabel="Onboarding theme palette options"
      />
    </div>

    <aside className="onboarding-aside" aria-label="Palette preview">
      <div className="onboarding-aside__heading">
        <Palette className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Your reading corner</h2>
      </div>
      <div className="onboarding-palette-preview">
        <div className="flex items-center gap-3">
          <ThemeAwareLogo variant="icon" size="h-10 w-10" />
          <div>
            <p className="font-display text-xl font-bold">{themes.find((theme) => theme.id === selectedTheme)?.name ?? "Warm Sunset"}</p>
            <p className="font-sans text-xs text-muted-foreground">A sample of your shelf</p>
          </div>
        </div>
        <div className="onboarding-preview-meter" aria-hidden="true">
          <span data-complete="true" />
          <span data-complete="true" />
          <span />
        </div>
        <div className="border-y border-border py-3">
          <p className="font-display text-lg font-semibold">The book you return to</p>
          <p className="mt-1 font-sans text-sm text-muted-foreground">Your place, notes, and next chapter.</p>
        </div>
      </div>
      <p className="mt-3 font-sans text-xs text-muted-foreground">
        Preview only. Your real shelf begins with the first book you add.
      </p>
    </aside>
  </div>
);

interface TasteStepProps {
  formData: OnboardingFormData;
  onToggleGenre: (genre: string) => void;
  onFieldChange: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  showValidation: boolean;
}

const TasteStep = ({ formData, onToggleGenre, onFieldChange, showValidation }: TasteStepProps) => {
  const [showAllGenres, setShowAllGenres] = useState(false);
  const collapsedGenres = GENRES.filter(
    (genre, index) => index < INITIAL_GENRE_COUNT || formData.favoriteGenres.includes(genre),
  );
  const visibleGenres = showAllGenres ? GENRES : collapsedGenres;
  const hiddenGenreCount = Math.max(0, GENRES.length - collapsedGenres.length);

  return (
    <div className="onboarding-step-layout">
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <OnboardingStepIntro
          step="taste"
          title="What keeps you turning pages?"
          description="Choose 1–12 genres you enjoy. These give Brack a starting point for book discovery and finding readers with shared tastes."
        />

        <div id="onboarding-genre-options" className="flex flex-wrap gap-2" role="group" aria-label="Favorite genres">
          {visibleGenres.map((genre) => {
            const selected = formData.favoriteGenres.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                disabled={!selected && formData.favoriteGenres.length >= MAX_SELECTED_GENRES}
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
            of {MAX_SELECTED_GENRES} genres selected
            {formData.favoriteGenres.length >= MAX_SELECTED_GENRES && ". Deselect one to choose another."}
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
        {showValidation && formData.favoriteGenres.length === 0 && (
          <p role="alert" className="font-sans text-sm text-destructive">Choose at least one genre, or use Skip to set up later.</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="slowestGenre">A genre you take your time with (optional)</Label>
            <Select value={formData.slowestGenre || "none"} onValueChange={(value) => onFieldChange("slowestGenre", value === "none" ? "" : value)}>
              <SelectTrigger id="slowestGenre" className="min-h-11">
                <SelectValue placeholder="No preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No preference</SelectItem>
                {GENRES.map((genre) => (
                  <SelectItem key={genre} value={genre}>
                    {genre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="font-sans text-xs leading-relaxed text-muted-foreground">A dense history and a quick mystery need not have the same pace.</p>
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

      <aside className="onboarding-aside" aria-label="Your reading taste">
        <div className="onboarding-aside__heading">
          <h2 className="font-display text-lg font-semibold">Room on your shelf for…</h2>
        </div>
        <p className="onboarding-feedback-copy" aria-live="polite" aria-atomic="true">{getTasteSummary(formData)}</p>
        <p className="mt-3 font-sans text-xs leading-relaxed text-muted-foreground">A starting point, not a box to stay in. You can explore beyond these choices.</p>
      </aside>
    </div>
  );
};

interface PaceStepProps {
  formData: OnboardingFormData;
  onFieldChange: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onNumberFieldChange: (key: keyof OnboardingFormData, value: string) => void;
  showValidation: boolean;
}

const PaceStep = ({ formData, onFieldChange, onNumberFieldChange, showValidation }: PaceStepProps) => (
  <div className="space-y-6">
    <OnboardingStepIntro
      step="pace"
      title="When does a book fit into your day?"
      description="Ten minutes counts. So does a long Sunday. Choose what feels doable, not what sounds impressive. Every answer here is optional."
    />

    <section className="onboarding-form-section" aria-labelledby="onboarding-session-length">
      <h2 id="onboarding-session-length" className="onboarding-form-section__title">
        A little window for reading
      </h2>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Suggested session lengths">
        {[10, 20, 30].map((minutes) => (
          <button
            key={minutes}
            type="button"
            aria-pressed={formData.preferredSessionMinutes === minutes}
            data-selected={formData.preferredSessionMinutes === minutes}
            className="onboarding-choice min-h-11 rounded-md border px-4 py-2 font-sans text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => onFieldChange("preferredSessionMinutes", minutes)}
          >
            {minutes} minutes
          </button>
        ))}
      </div>
      <div className="max-w-sm">
        <NumberField
          id="sessionLength"
          label="Minutes per reading session"
          value={numberToInput(formData.preferredSessionMinutes)}
          onChange={(value) => onNumberFieldChange("preferredSessionMinutes", value)}
          placeholder="20"
          min={5}
          max={300}
          error={showValidation ? getSessionValidationMessage(formData.preferredSessionMinutes) : null}
        />
        <p className="mt-2 font-sans text-xs leading-relaxed text-muted-foreground">Use a suggestion, enter your own, or leave it blank.</p>
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

    <aside className="onboarding-feedback" aria-label="Your reading rhythm">
      <h2 className="font-display text-lg font-semibold">A rhythm, not a rule</h2>
      <p className="onboarding-feedback-copy mt-2" aria-live="polite" aria-atomic="true">{getReadingRhythmSummary(formData)}</p>
      <p className="mt-2 font-sans text-xs leading-relaxed text-muted-foreground">This describes your preference. It does not schedule a reminder or set a timer.</p>
    </aside>

    <div className="onboarding-form-section space-y-2">
      <Label htmlFor="motivation">What would you like reading to bring you? (optional)</Label>
      <Input
        id="motivation"
        aria-label="What would you like reading to bring you? (optional)"
        className="min-h-11"
        value={formData.motivation}
        onChange={(event) => onFieldChange("motivation", event.target.value)}
        placeholder="A quieter evening, a new idea, a little escape…"
        maxLength={240}
      />
    </div>

    <details className="onboarding-details">
      <summary>Add more detail (optional)</summary>
      <p className="my-3 font-sans text-sm leading-relaxed text-muted-foreground">Already know your recent pace? Add a rough estimate. Leaving these blank is fine.</p>
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3">
        <NumberField id="books6mo" label="Books in 6 months" value={numberToInput(formData.booksReadSixMonths)} onChange={(value) => onNumberFieldChange("booksReadSixMonths", value)} placeholder="6" max={500} />
        <NumberField id="books1yr" label="Books in 1 year" value={numberToInput(formData.booksReadYear)} onChange={(value) => onNumberFieldChange("booksReadYear", value)} placeholder="12" max={1000} />
        <NumberField id="avgDays" label="Average days per book" value={numberToInput(formData.averageDaysPerBook)} onChange={(value) => onNumberFieldChange("averageDaysPerBook", value)} placeholder="21" min={1} max={365} />
      </div>
    </details>
  </div>
);

interface GoalStepProps {
  formData: OnboardingFormData;
  onFieldChange: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onNumberFieldChange: (key: keyof OnboardingFormData, value: string) => void;
  showValidation: boolean;
  onStartValidityChange: (valid: boolean) => void;
  onEndValidityChange: (valid: boolean) => void;
}

const GoalStep = ({ formData, onFieldChange, onNumberFieldChange, showValidation, onStartValidityChange, onEndValidityChange }: GoalStepProps) => (
  <div className="onboarding-step-layout">
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <OnboardingStepIntro
        step="goal"
        title="Give yourself something to read toward"
        description="Start with a book count and a time frame that feels comfortable. You can adjust your goal as life changes."
      />

      <div className="onboarding-goal-fields grid grid-cols-1 gap-4">
        <NumberField
          id="targetBooks"
          label="Target books"
          value={numberToInput(formData.goalTargetBooks)}
          onChange={(value) => onNumberFieldChange("goalTargetBooks", value)}
          placeholder="12"
          min={1}
          max={365}
          required
        />
        <DatePicker
          id="goalStart"
          className="min-w-0"
          label="Start date"
          value={formData.goalStartDate}
          onChange={(value) => onFieldChange("goalStartDate", value)}
          maxDate={formData.goalEndDate}
          showToday
          required
          onValidityChange={onStartValidityChange}
        />
        <DatePicker
          id="goalEnd"
          className="min-w-0"
          label="End date"
          value={formData.goalEndDate}
          onChange={(value) => onFieldChange("goalEndDate", value)}
          minDate={formData.goalStartDate}
          showToday
          required
          onValidityChange={onEndValidityChange}
        />
      </div>
      {showValidation && getGoalValidationMessage(formData) && (
        <p role="alert" className="font-sans text-sm text-destructive">{getGoalValidationMessage(formData)}</p>
      )}

      <div className="onboarding-reminder-row border-y border-border py-4">
        <div className="flex items-start justify-between gap-4">
          <Label htmlFor="onboarding-reminder" className="min-h-11 min-w-0 flex-1 cursor-pointer py-1">
            <span className="block font-sans text-base font-medium text-foreground">Daily reminder</span>
            <p className="font-sans text-sm text-muted-foreground">
              Choose a daily nudge. On supported devices, you will still need to allow notifications before Brack can send it.
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

    <aside className="onboarding-aside" aria-label="Your goal at a glance">
      <img
        src={BRACK_GOALS_IMAGE}
        alt=""
        aria-hidden="true"
        className="onboarding-floating-art mb-4 h-20 w-20 object-contain"
        decoding="async"
      />
      <h2 className="font-display text-lg font-semibold">Your goal at a glance</h2>
      <p className="onboarding-feedback-copy mt-2" aria-live="polite" aria-atomic="true">{getGoalPaceSummary(formData)}</p>
      <p className="mt-3 font-sans text-xs leading-relaxed text-muted-foreground">An even pace for this target, not a prediction. Every book takes its own time.</p>
    </aside>
  </div>
);

const ReviewStep = ({ formData, isPreAuth = false, onEdit }: {
  formData: OnboardingFormData;
  isPreAuth?: boolean;
  onEdit: (step: OnboardingStepId) => void;
}) => (
  <div className="onboarding-step-layout">
    <div className="min-w-0 space-y-5">
      <OnboardingStepIntro
        step="review"
        title="Your next chapter starts here"
        description={
          isPreAuth
            ? "Here is your starting plan. Create and verify your account next to keep these choices. Until then, refreshing or closing this setup starts over."
            : "Here is your starting plan. Save it now, and change anything later in Settings."
        }
      />

      <div className="onboarding-summary-ledger">
        <SummaryRow index="01" title="Taste" onEdit={() => onEdit("taste")}>
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

        <SummaryRow index="02" title="Palette" onEdit={() => onEdit("palette")}>
          <p>{themes.find((theme) => theme.id === formData.colorTheme)?.name ?? "Warm Sunset"}</p>
          <p className="text-muted-foreground">
            {isPreAuth ? "Your chosen palette carries into sign-up" : "Your app appearance"}
          </p>
        </SummaryRow>

        <SummaryRow index="03" title="Pace" onEdit={() => onEdit("pace")}>
          <p>{getReadingRhythmSummary(formData)}</p>
          {formData.motivation.trim() && <p className="mt-2 text-muted-foreground">Your reason to read: {formData.motivation.trim()}</p>}
        </SummaryRow>

        <SummaryRow index="04" title="Goal" onEdit={() => onEdit("goal")}>
          <p>{getGoalPaceSummary(formData)}</p>
          <p className="text-muted-foreground">
            {formData.reminderEnabled ? `Daily reminder preference: ${formData.reminderTime ?? "19:00"}. Device permission is still needed.` : "Reminders are off"}
          </p>
        </SummaryRow>

        <SummaryRow index="05" title="Format" onEdit={() => onEdit("pace")}>
          <p>{getBookFormatLabel(formData.preferredBookFormat)}</p>
          <p className="text-muted-foreground">Book length: {getBookLengthLabel(formData.preferredBookLength)}</p>
          <Button type="button" variant="ghost" className="onboarding-button onboarding-button--quiet mt-1 min-h-11 px-2" onClick={() => onEdit("taste")}>Edit book length</Button>
        </SummaryRow>
      </div>
    </div>

    <aside className="onboarding-aside" aria-label="Your first real reading action">
      <img
        src={BRACK_TROPHY_IMAGE}
        alt=""
        aria-hidden="true"
        className="onboarding-floating-art mb-4 h-20 w-20 object-contain"
        decoding="async"
      />
      <h2 className="font-display text-xl font-bold">Then, bring your book</h2>
      <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">Add the book you are reading, set your current page, and make your next reading session the first entry in your record.</p>
      <p className="mt-3 font-sans text-xs leading-relaxed text-muted-foreground">The welcome practice stays a sample. It will not appear in your library or count toward this goal.</p>
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
  min,
  max,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  min?: number;
  max?: number;
  error?: string | null;
}) => (
  <div className="min-w-0 space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      aria-label={label}
      className="min-h-11"
      type="number"
      min={min ?? (required ? 1 : 0)}
      max={max}
      step={1}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? `${id}-error` : undefined}
      inputMode="numeric"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required={required}
    />
    {error && <p id={`${id}-error`} role="alert" className="font-sans text-sm text-destructive">{error}</p>}
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

const SummaryRow = ({ index, title, children, onEdit }: { index: string; title: string; children: ReactNode; onEdit: () => void }) => (
  <div className="onboarding-summary-row">
    <span className="onboarding-summary-row__index" aria-hidden="true">
      {index}
    </span>
    <div>
      <h2 className="onboarding-summary-row__title">{title}</h2>
      <Button type="button" variant="ghost" className="onboarding-button onboarding-button--quiet min-h-11 px-2" aria-label={`Edit ${title.toLowerCase()}`} onClick={onEdit}>Edit</Button>
    </div>
    <div className="onboarding-summary-row__value">{children}</div>
  </div>
);

export default Onboarding;
