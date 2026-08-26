import { useEffect, useRef, useState } from "react";
import type { ElementType, ReactNode, RefObject } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { gsap } from "gsap";
import {
  Check,
  Clock,
  NavArrowLeft,
  NavArrowRight,
  Palette,
  Refresh,
  SkipNext,
} from "iconoir-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import {
  OnboardingChapterIndicator,
  type OnboardingChapter,
} from "@/components/onboarding/OnboardingChapterIndicator";
import {
  OnboardingLoadingState,
  OnboardingRouteTransition,
} from "@/components/onboarding/OnboardingLoadingState";
import "@/components/onboarding/onboarding.css";
import { ThemePaletteCarousel } from "@/components/ThemePaletteCarousel";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useGSAP } from "@/hooks/useGSAP";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useReadingProfile } from "@/hooks/useReadingProfile";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { themes } from "@/lib/themes";
import { GENRES } from "@/constants";
import { APP_ICONS } from "@/config/iconography";
import {
  BRACK_GOALS_IMAGE,
  BRACK_STREAK_HAPPY_IMAGE,
  BRACK_TROPHY_IMAGE,
} from "@/config/brackAssets";
import {
  DEFAULT_ONBOARDING_FORM,
  ONBOARDING_STEPS,
  getOnboardingErrorMessage,
  markOnboardingInProgress,
  saveOnboardingProfile,
  skipOnboarding,
  type OnboardingStepId,
} from "@/services/onboarding";
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

const BOOK_LENGTH_OPTIONS: Array<{ value: PreferredBookLength; label: string; description: string }> = [
  { value: "short", label: "Short", description: "Under 250 pages" },
  { value: "medium", label: "Medium", description: "250-400 pages" },
  { value: "long", label: "Long", description: "400+ pages" },
  { value: "varied", label: "Varied", description: "Depends on the book" },
];

const READING_TIME_OPTIONS: Array<{ value: PreferredReadingTime; label: string }> = [
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

const numberToInput = (value: number | null) => (value === null ? "" : String(value));

const parseNullableNumber = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const Onboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const {
    status,
    loading: statusLoading,
    refetch: refetchStatus,
  } = useOnboardingStatus(user?.id);
  const {
    habits,
    loading: profileLoading,
    refetch: refetchProfile,
  } = useReadingProfile(user?.id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentTheme, resolvedTheme, setTheme } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormData>(DEFAULT_ONBOARDING_FORM);
  const [saving, setSaving] = useState(false);
  const [transition, setTransition] = useState<OnboardingTransition | null>(null);
  const [completionBurst, setCompletionBurst] = useState(false);
  const onboardingExitCommittedRef = useRef(false);
  const hydratedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const previousStepIndexRef = useRef(stepIndex);
  const selectedGenresRef = useRef<HTMLDivElement>(null);
  const goalNumberRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  const currentStep = ONBOARDING_STEPS[stepIndex];
  const entrySource = searchParams.get("from");
  const returnPath = entrySource === "settings" ? "/settings" : "/dashboard";
  const isCompletedEdit =
    status?.onboarding_status === "completed" &&
    (searchParams.get("edit") === "1" || entrySource === "settings" || entrySource === "dashboard");

  useGSAP(() => {
    if (!rootRef.current) return;

    const shellElements = rootRef.current.querySelectorAll(".onboarding-logo, .onboarding-shell");

    if (reducedMotion) {
      gsap.set(shellElements, { autoAlpha: 1, y: 0, scale: 1 });
      return;
    }

    gsap.fromTo(
      shellElements,
      { autoAlpha: 0, y: 28, scale: 0.96 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.12, ease: "power3.out" },
    );
  }, [reducedMotion]);

  useGSAP(() => {
    if (!pageRef.current) return;

    if (reducedMotion) {
      gsap.set(pageRef.current, { autoAlpha: 1, x: 0, y: 0, rotateY: 0 });
      return;
    }

    gsap.fromTo(
      pageRef.current,
      {
        autoAlpha: 0,
        x: stepIndex === 0 ? 0 : 34,
        y: 18,
        rotateY: stepIndex === 0 ? 0 : -7,
        transformOrigin: "left center",
      },
      { autoAlpha: 1, x: 0, y: 0, rotateY: 0, duration: 0.55, ease: "power3.out" },
    );
  }, [stepIndex, reducedMotion]);

  useEffect(() => {
    if (!goalNumberRef.current || reducedMotion) {
      if (goalNumberRef.current) {
        goalNumberRef.current.textContent = String(formData.goalTargetBooks ?? 0);
      }
      return;
    }

    const target = formData.goalTargetBooks ?? 0;
    const model = { value: Number(goalNumberRef.current.textContent || 0) };
    const tween = gsap.to(model, {
      value: target,
      duration: 0.55,
      ease: "power2.out",
      onUpdate: () => {
        if (goalNumberRef.current) {
          goalNumberRef.current.textContent = String(Math.round(model.value));
        }
      },
    });

    return () => {
      tween.kill();
    };
  }, [formData.goalTargetBooks, reducedMotion]);

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
    if (!user && !authLoading) {
      navigate("/auth?mode=signup", { replace: true });
    }
  }, [authLoading, navigate, user]);

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
      preferredReadingTime: (habits.preferred_reading_time as PreferredReadingTime | null) ?? current.preferredReadingTime,
      readingFrequency: (habits.reading_frequency as ReadingFrequency | null) ?? current.readingFrequency,
      motivation: habits.motivation ?? current.motivation,
      preferredBookFormat: (habits.book_format as PreferredBookFormat | null) ?? current.preferredBookFormat,
    }));
  }, [habits, profileLoading]);

  if (transition) {
    return <OnboardingRouteTransition to={transition.to} message={transition.message} minDisplayTime={950} />;
  }

  if (authLoading || statusLoading || profileLoading) {
    return <OnboardingLoadingState />;
  }

  if (!user) return null;

  const updateField = <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const setNumberField = (key: keyof OnboardingFormData, value: string) => {
    setFormData((current) => ({ ...current, [key]: parseNullableNumber(value) }));
  };

  const animateSelectedGenre = () => {
    if (!selectedGenresRef.current || reducedMotion) return;
    const chips = selectedGenresRef.current.querySelectorAll(".selected-genre-chip");
    const latest = chips[chips.length - 1];
    if (!latest) return;

    gsap.fromTo(
      latest,
      { autoAlpha: 0, x: -56, y: -18, scale: 0.7, rotate: -8 },
      { autoAlpha: 1, x: 0, y: 0, scale: 1, rotate: 0, duration: 0.45, ease: "back.out(1.8)" },
    );
  };

  const toggleGenre = (genre: string) => {
    const adding = !formData.favoriteGenres.includes(genre);
    setFormData((current) => ({
      ...current,
      favoriteGenres: current.favoriteGenres.includes(genre)
        ? current.favoriteGenres.filter((item) => item !== genre)
        : [...current.favoriteGenres, genre],
    }));

    if (adding) {
      window.requestAnimationFrame(animateSelectedGenre);
    }
  };

  const handlePaletteSelect = async (themeId: string) => {
    try {
      updateField("colorTheme", themeId);
      await setTheme(themeId);
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
      setStepIndex((index) => index + 1);
      return;
    }

    void handleComplete();
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((index) => index - 1);
      return;
    }

    navigate("/", { replace: false });
  };

  const handleSkip = async () => {
    try {
      setSaving(true);

      if (!isCompletedEdit) {
        await skipOnboarding(user.id, currentStep);
        onboardingExitCommittedRef.current = true;
        await Promise.all([refetchStatus(), refetchProfile()]);
      }

      navigate(returnPath, { replace: true });
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
      await saveOnboardingProfile(user.id, formData);
      onboardingExitCommittedRef.current = true;
      await Promise.all([refetchStatus(), refetchProfile()]);

      if (!reducedMotion) {
        setCompletionBurst(true);
        window.setTimeout(() => {
          setTransition({
            to: "/dashboard",
            message: "Personalizing your dashboard...",
          });
        }, 520);
      } else {
        setTransition({
          to: "/dashboard",
          message: "Personalizing your dashboard...",
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
    if (nextIndex >= 0) setStepIndex(nextIndex);
  };

  return (
    <div
      ref={rootRef}
      className="onboarding-root relative overflow-hidden bg-gradient-background px-3 sm:px-5 md:px-8"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-[8%] h-40 w-40 rounded-full border border-primary/15" />
        <div className="absolute right-[10%] top-[20%] h-64 w-64 rounded-full border border-primary/10" />
        <div className="absolute bottom-[8%] left-[20%] h-52 w-52 rounded-full border border-accent/15" />
      </div>

      {completionBurst && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          {Array.from({ length: 20 }).map((_, index) => (
            <span
              key={index}
              className="absolute h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary)/0.6)] animate-ping"
              style={{
                transform: `rotate(${index * 18}deg) translateY(-${60 + (index % 5) * 16}px)`,
                animationDelay: `${index * 22}ms`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col">
        <header className="onboarding-logo flex shrink-0 items-center justify-between gap-3 py-1">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex min-h-11 items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:gap-3"
            aria-label="Return to Brack home"
          >
            <ThemeAwareLogo variant="icon" size="h-9 w-9 sm:h-10 sm:w-10" className="drop-shadow-sm" />
            <span aria-hidden="true">
              <span className="block font-display text-xl font-bold leading-none">Brack</span>
              <span className="hidden font-sans text-xs text-muted-foreground sm:block">Reading tracker</span>
            </span>
          </button>

          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={saving}
            className="min-h-11 shrink-0 px-3"
          >
            <SkipNext className="mr-2 h-4 w-4" />
            {isCompletedEdit ? "Close" : "Skip for now"}
          </Button>
        </header>

        <main className="onboarding-shell flex min-h-0 flex-1 py-3 sm:py-4 lg:py-5">
          <Card className="mx-auto flex h-full w-full max-w-6xl overflow-hidden rounded-xl border-border/70 bg-card/95 shadow-medium backdrop-blur">
            <CardContent className="flex h-full min-h-0 w-full flex-col p-0">
              <div className="shrink-0 border-b border-border/70 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
                <OnboardingChapterIndicator
                  chapters={ONBOARDING_CHAPTERS}
                  currentStep={currentStep}
                  disabled={saving}
                  onStepSelect={selectStep}
                />
              </div>

              <div
                ref={contentScrollRef}
                className="onboarding-content-scroll relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:p-8"
              >
                <div
                  ref={pageRef}
                  className="onboarding-page min-h-full focus:outline-none"
                  role="region"
                  aria-label={`${STEP_LABELS[currentStep]} onboarding chapter`}
                  tabIndex={-1}
                >
                  {currentStep === "welcome" && (
                    <WelcomeStep
                      userName={
                        (user.user_metadata as Record<string, string | undefined> | undefined)?.first_name ||
                        user.email?.split("@")[0]
                      }
                    />
                  )}

                  {currentStep === "taste" && (
                    <TasteStep
                      formData={formData}
                      selectedGenresRef={selectedGenresRef}
                      onToggleGenre={toggleGenre}
                      onFieldChange={updateField}
                    />
                  )}

                  {currentStep === "palette" && (
                    <PaletteStep
                      selectedTheme={currentTheme}
                      previewMode={resolvedTheme === "dark" ? "dark" : "light"}
                      onSelectTheme={handlePaletteSelect}
                    />
                  )}

                  {currentStep === "pace" && (
                    <PaceStep
                      formData={formData}
                      onFieldChange={updateField}
                      onNumberFieldChange={setNumberField}
                    />
                  )}

                  {currentStep === "goal" && (
                    <GoalStep
                      formData={formData}
                      goalNumberRef={goalNumberRef}
                      onFieldChange={updateField}
                      onNumberFieldChange={setNumberField}
                    />
                  )}

                  {currentStep === "review" && <ReviewStep formData={formData} />}
                </div>
              </div>

              <div className="onboarding-action-dock flex shrink-0 items-center gap-3 border-t border-border/70 bg-card/95 px-4 pt-3 backdrop-blur sm:justify-between sm:px-6 sm:pt-4 lg:px-8">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={saving}
                  className="min-h-11 shrink-0"
                >
                  <NavArrowLeft className="mr-2 h-4 w-4" />
                  {stepIndex === 0 ? "Home" : "Back"}
                </Button>

                <Button
                  onClick={handleNext}
                  disabled={saving}
                  className="min-h-11 min-w-0 flex-1 sm:min-w-[10rem] sm:flex-none"
                >
                  {saving ? (
                    <>
                      <Refresh className="mr-2 h-4 w-4 animate-spin" />
                      Saving
                    </>
                  ) : stepIndex === ONBOARDING_STEPS.length - 1 ? (
                    <>
                      Finish setup
                      <Check className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continue
                      <NavArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

const WelcomeStep = ({ userName }: { userName?: string }) => (
  <div className="grid min-h-full gap-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center lg:gap-10">
    <div className="space-y-5 lg:py-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm text-primary">
        <APP_ICONS.dashboard.insights className="h-4 w-4" />
        Your first reading profile
      </div>
      <div className="space-y-3">
        <h1 className="max-w-3xl font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
          {userName ? `${userName}, ` : ""}make Brack feel like it already knows your library.
        </h1>
        <p className="max-w-2xl font-sans text-base text-muted-foreground sm:text-lg">
          A few thoughtful choices shape your goals, recommendations, and daily reading rhythm. You can change
          everything later in Settings.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Make it yours", "Choose a palette and the books you love."],
          ["Find your rhythm", "Set a pace that fits your real life."],
          ["Read with direction", "Give your dashboard a useful first goal."],
        ].map(([title, body], index) => (
          <div
            key={title}
            className="rounded-lg border border-border/65 bg-muted/25 p-3.5"
          >
            <span className="mb-2 grid h-7 w-7 place-items-center rounded-md bg-primary/10 font-sans text-xs font-bold text-primary">
              {index + 1}
            </span>
            <p className="font-sans text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 font-sans text-xs text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </div>

    <div className="streak-art-stage mx-auto w-[clamp(8.5rem,28vw,13rem)] self-center" aria-hidden="true">
      <span className="streak-art-aura" />
      <span className="streak-art-shadow" />
      <img
        src={BRACK_STREAK_HAPPY_IMAGE}
        alt=""
        className="streak-art-float onboarding-floating-art aspect-square w-full object-contain"
        decoding="async"
      />
    </div>
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
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_17rem]">
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold">Pick the palette Brack should remember</h2>
        <p className="font-sans text-sm text-muted-foreground">
          This applies immediately across the app and is saved to your profile. You can change it later in Settings.
        </p>
      </div>

      <ThemePaletteCarousel
        selectedTheme={selectedTheme}
        previewMode={previewMode}
        onSelectTheme={onSelectTheme}
        ariaLabel="Onboarding theme palette options"
      />
    </div>

    <div className="rounded-lg bg-muted/30 p-4">
      <div className="mb-4 flex items-center gap-2">
        <Palette className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-semibold">Live preview</h3>
      </div>
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
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
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border bg-background p-3">
            <p className="font-sans text-xs text-muted-foreground">Goal</p>
            <p className="font-sans text-lg font-bold text-primary">12</p>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="font-sans text-xs text-muted-foreground">Streak</p>
            <p className="font-sans text-lg font-bold text-primary">3</p>
          </div>
        </div>
      </div>
      <p className="mt-3 font-sans text-xs text-muted-foreground">
        Public pages stay on Brack's default palette. This palette starts after you choose it.
      </p>
    </div>
  </div>
);

interface TasteStepProps {
  formData: OnboardingFormData;
  selectedGenresRef: RefObject<HTMLDivElement>;
  onToggleGenre: (genre: string) => void;
  onFieldChange: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
}

const TasteStep = ({
  formData,
  selectedGenresRef,
  onToggleGenre,
  onFieldChange,
}: TasteStepProps) => (
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Choose the genres Brack should learn first</h2>
        <p className="font-sans text-sm text-muted-foreground">
          Pick at least one. These become search chips, reader matching signals, and recommendation context.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Favorite genres">
        {GENRES.map((genre) => {
          const selected = formData.favoriteGenres.includes(genre);
          return (
            <button
              key={genre}
              type="button"
              onClick={() => onToggleGenre(genre)}
              aria-pressed={selected}
              className={cn(
                "min-h-11 rounded-full border px-3 py-2 font-sans text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background hover:border-primary/60 hover:bg-primary/10",
              )}
            >
              {genre}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="slowestGenre">Slowest genre</Label>
          <Select
            value={formData.slowestGenre}
            onValueChange={(value) => onFieldChange("slowestGenre", value)}
          >
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
          <div className="grid grid-cols-2 gap-2">
            {BOOK_LENGTH_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onFieldChange("preferredBookLength", option.value)}
                aria-pressed={formData.preferredBookLength === option.value}
                className={cn(
                  "min-h-11 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  formData.preferredBookLength === option.value
                    ? "border-primary bg-primary/[0.12] text-primary"
                    : "border-border bg-background hover:bg-muted/60",
                )}
              >
                <span className="block font-sans text-sm font-semibold">{option.label}</span>
                <span className="block font-sans text-xs text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </div>

    <div className="rounded-lg bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <APP_ICONS.readers.similarTaste className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-semibold">Selected genres</h3>
      </div>
      <div ref={selectedGenresRef} className="flex min-h-20 flex-wrap content-start gap-2">
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
    </div>
  </div>
);

interface PaceStepProps {
  formData: OnboardingFormData;
  onFieldChange: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onNumberFieldChange: (key: keyof OnboardingFormData, value: string) => void;
}

const PaceStep = ({ formData, onFieldChange, onNumberFieldChange }: PaceStepProps) => (
  <div className="space-y-6">
    <div>
      <h2 className="font-display text-2xl font-bold">Tell Brack how reading fits your real life</h2>
      <p className="font-sans text-sm text-muted-foreground">
        These fields are optional, but they make goal suggestions and streak nudges less generic.
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

    <div className="grid gap-4 md:grid-cols-3">
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
    </div>

    <div className="space-y-2">
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
  goalNumberRef: RefObject<HTMLSpanElement>;
  onFieldChange: <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;
  onNumberFieldChange: (key: keyof OnboardingFormData, value: string) => void;
}

const GoalStep = ({
  formData,
  goalNumberRef,
  onFieldChange,
  onNumberFieldChange,
}: GoalStepProps) => (
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Set a first target</h2>
        <p className="font-sans text-sm text-muted-foreground">
          Brack uses this for dashboard progress, analytics targets, and smarter empty states.
        </p>
      </div>

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

      <div className="rounded-lg bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="onboarding-reminder" className="min-h-11 cursor-pointer py-1">
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

    <div className="rounded-lg bg-muted/30 p-4 text-center">
      <img
        src={BRACK_GOALS_IMAGE}
        alt=""
        aria-hidden="true"
        className="onboarding-floating-art mx-auto mb-4 h-36 w-36 object-contain"
        decoding="async"
      />
      <div className="font-sans text-sm text-muted-foreground">Current target</div>
      <div className="font-display text-5xl font-bold text-primary">
        <span ref={goalNumberRef}>{formData.goalTargetBooks ?? 0}</span>
      </div>
      <div className="font-sans text-sm text-muted-foreground">books</div>
    </div>
  </div>
);

const ReviewStep = ({ formData }: { formData: OnboardingFormData }) => (
  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold">This is the starting profile Brack will use</h2>
        <p className="font-sans text-sm text-muted-foreground">
          You can edit this from Settings later. Completing now removes the dashboard setup prompt.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SummaryCard title="Taste" icon={APP_ICONS.readers.similarTaste}>
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
        </SummaryCard>

        <SummaryCard title="Palette" icon={Palette}>
          <p>{themes.find((theme) => theme.id === formData.colorTheme)?.name ?? "Warm Sunset"}</p>
          <p className="text-muted-foreground">Saved to your app appearance</p>
        </SummaryCard>

        <SummaryCard title="Pace" icon={Clock}>
          <p>{formData.preferredSessionMinutes ?? "No"} min sessions</p>
          <p className="text-muted-foreground">
            {formData.readingFrequency || "No cadence"} · {formData.preferredReadingTime || "No time set"}
          </p>
        </SummaryCard>

        <SummaryCard title="Goal" icon={APP_ICONS.dashboard.goal}>
          <p>{formData.goalTargetBooks ?? 0} books</p>
          <p className="text-muted-foreground">
            {formData.reminderEnabled ? `Reminder at ${formData.reminderTime}` : "No reminder"}
          </p>
        </SummaryCard>

        <SummaryCard title="Learning signals" icon={APP_ICONS.dashboard.insights}>
          <p>{formData.preferredBookLength || "Any"} length</p>
          <p className="text-muted-foreground">{formData.preferredBookFormat || "Any"} format</p>
        </SummaryCard>
      </div>
    </div>

    <div className="rounded-lg bg-muted/30 p-4 text-center">
      <img
        src={BRACK_TROPHY_IMAGE}
        alt=""
        aria-hidden="true"
        className="onboarding-floating-art mx-auto mb-4 h-36 w-36 object-contain"
        decoding="async"
      />
      <p className="font-display text-xl font-bold">Ready to personalize</p>
      <p className="font-sans text-sm text-muted-foreground">
        Habits, goal, notification preference, and learning signals will be saved together.
      </p>
    </div>
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
    <div className="grid gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "min-h-11 rounded-md border px-3 py-2 text-left font-sans text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            value === option.value
              ? "border-primary bg-primary/[0.12] text-primary"
              : "border-border bg-background hover:bg-muted/60",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  </fieldset>
);

const SummaryCard = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ElementType;
  children: ReactNode;
}) => (
  <div className="rounded-lg bg-muted/30 p-4">
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="font-display text-lg font-semibold">{title}</h3>
    </div>
    <div className="font-sans text-sm">{children}</div>
  </div>
);

export default Onboarding;
