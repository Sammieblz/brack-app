import { useEffect, useMemo, useRef, useState } from "react";
import type { ElementType, ReactNode, RefObject } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { gsap } from "gsap";
import {
  Check,
  Clock,
  NavArrowLeft,
  NavArrowRight,
  Refresh,
  SkipNext,
  Xmark,
} from "iconoir-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { BrandedRouteTransition } from "@/components/animations/BrandedRouteTransition";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { useGSAP } from "@/hooks/useGSAP";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useReadingProfile } from "@/hooks/useReadingProfile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
  taste: "Taste",
  pace: "Pace",
  goal: "Goal",
  review: "Review",
};

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
  const { habits, loading: profileLoading } = useReadingProfile(user?.id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState<OnboardingFormData>(DEFAULT_ONBOARDING_FORM);
  const [saving, setSaving] = useState(false);
  const [transition, setTransition] = useState<OnboardingTransition | null>(null);
  const [completionBurst, setCompletionBurst] = useState(false);
  const hydratedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const selectedGenresRef = useRef<HTMLDivElement>(null);
  const goalNumberRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const currentStep = ONBOARDING_STEPS[stepIndex];
  const progress = Math.round(((stepIndex + 1) / ONBOARDING_STEPS.length) * 100);
  const isCompletedEdit = status?.onboarding_status === "completed" && searchParams.get("edit") === "1";

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

    return () => tween.kill();
  }, [formData.goalTargetBooks, reducedMotion]);

  useEffect(() => {
    if (!user && !authLoading) {
      navigate("/auth?mode=signup", { replace: true });
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (
      !user?.id ||
      isCompletedEdit ||
      !status?.onboarding_status ||
      status.onboarding_status === "completed"
    ) {
      return;
    }

    markOnboardingInProgress(user.id, currentStep).catch((err) => {
      console.error("Failed to mark onboarding progress:", err);
    });
  }, [currentStep, isCompletedEdit, status?.onboarding_status, user?.id]);

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
    return <BrandedRouteTransition to={transition.to} message={transition.message} minDisplayTime={950} />;
  }

  if (authLoading || statusLoading) {
    return (
      <div className="flex min-h-app-viewport items-center justify-center bg-background">
        <LoadingSpinner size="lg" text="Preparing your setup..." />
      </div>
    );
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
      await skipOnboarding(user.id, currentStep);
      await refetchStatus();
      setTransition({
        to: "/dashboard",
        message: "Opening your dashboard...",
      });
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

  const StepIcon = STEP_META[currentStep].icon;
  const selectStep = (step: OnboardingStepId) => {
    const nextIndex = ONBOARDING_STEPS.indexOf(step);
    if (nextIndex >= 0) setStepIndex(nextIndex);
  };

  return (
    <div
      ref={rootRef}
      className="relative min-h-app-viewport overflow-x-hidden overflow-y-auto bg-gradient-background px-3 py-4 safe-bottom safe-top sm:px-5 md:px-8"
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

      <div className="relative z-10 mx-auto flex min-h-[calc(var(--app-viewport-height,100dvh)-2rem)] w-full max-w-7xl flex-col">
        <header className="onboarding-logo flex items-center justify-between py-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
          >
            <ThemeAwareLogo variant="icon" tone="theme" size="h-10 w-10" className="drop-shadow-sm" />
            <span>
              <span className="block font-display text-xl font-bold leading-none">Brack</span>
              <span className="block font-sans text-xs text-muted-foreground">Reading tracker</span>
            </span>
          </button>

          <Button variant="ghost" size="sm" onClick={handleSkip} disabled={saving}>
            <SkipNext className="mr-2 h-4 w-4" />
            Skip for now
          </Button>
        </header>

        <main className="onboarding-shell grid flex-1 items-center gap-5 py-4 lg:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.18fr)] lg:py-8">
          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-5">
              <div className="rounded-lg border border-border/70 bg-card/80 p-5 shadow-sm backdrop-blur">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/12 text-primary">
                    <StepIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-sans text-xs font-semibold uppercase tracking-wide text-primary">
                      {STEP_META[currentStep].eyebrow}
                    </p>
                    <h1 className="font-display text-2xl font-bold leading-tight">
                      {STEP_META[currentStep].title}
                    </h1>
                  </div>
                </div>

                <Progress value={progress} className="h-2" />
                <div className="mt-5 space-y-2">
                  {ONBOARDING_STEPS.map((step, index) => {
                    const MetaIcon = STEP_META[step].icon;
                    const active = index === stepIndex;
                    const done = index < stepIndex;

                    return (
                      <button
                        key={step}
                        type="button"
                        onClick={() => selectStep(step)}
                        aria-current={active ? "step" : undefined}
                        disabled={saving}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors disabled:pointer-events-none disabled:opacity-60",
                          active ? "bg-primary/12 text-primary" : "hover:bg-muted/60",
                        )}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-background">
                          {done ? <Check className="h-4 w-4" /> : <MetaIcon className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-sans text-sm font-semibold">
                            {STEP_LABELS[step]}
                          </span>
                          <span className="block truncate font-sans text-xs text-muted-foreground">
                            {STEP_META[step].eyebrow}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <VisualLearningCard formData={formData} />
            </div>
          </aside>

          <Card className="mx-auto w-full max-w-4xl overflow-hidden rounded-xl border-border/70 bg-card/95 shadow-sm backdrop-blur">
            <CardContent className="p-0">
              <div className="border-b border-border/70 p-4 lg:hidden">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <StepIcon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-sans text-xs font-semibold uppercase text-primary">
                        {STEP_META[currentStep].eyebrow}
                      </p>
                      <h1 className="font-display text-xl font-bold">{STEP_META[currentStep].title}</h1>
                    </div>
                  </div>
                  <Badge variant="outline">{stepIndex + 1}/{ONBOARDING_STEPS.length}</Badge>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {ONBOARDING_STEPS.map((step) => {
                    const MetaIcon = STEP_META[step].icon;
                    const active = step === currentStep;

                    return (
                      <Button
                        key={step}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        className="shrink-0 gap-1.5"
                        onClick={() => selectStep(step)}
                        disabled={saving}
                      >
                        <MetaIcon className="h-3.5 w-3.5" />
                        {STEP_LABELS[step]}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="relative p-4 sm:p-6 lg:p-8">
                <div ref={pageRef} className="onboarding-page min-h-[29rem]">
                  {currentStep === "welcome" && (
                    <WelcomeStep
                      userName={
                        (user.user_metadata as Record<string, string | undefined> | undefined)?.first_name ||
                        user.email?.split("@")[0]
                      }
                      onStepSelect={selectStep}
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

              <div className="flex flex-col-reverse gap-3 border-t border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleBack} disabled={saving}>
                    <NavArrowLeft className="mr-2 h-4 w-4" />
                    {stepIndex === 0 ? "Home" : "Back"}
                  </Button>
                  <Button variant="ghost" onClick={handleSkip} disabled={saving}>
                    Skip
                  </Button>
                </div>

                <Button onClick={handleNext} disabled={saving} className="min-w-[9rem]">
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

const WelcomeStep = ({
  userName,
  onStepSelect,
}: {
  userName?: string;
  onStepSelect: (step: OnboardingStepId) => void;
}) => (
  <div className="grid h-full gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-center">
    <div className="space-y-5">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm text-primary">
        <APP_ICONS.dashboard.insights className="h-4 w-4" />
        First-run reading profile
      </div>
      <div className="space-y-3">
        <h2 className="font-display text-3xl font-bold leading-tight md:text-5xl">
          {userName ? `${userName}, ` : ""}make Brack feel like it already knows your library.
        </h2>
        <p className="max-w-2xl font-sans text-base text-muted-foreground md:text-lg">
          This setup seeds your goals, recommendations, discovery matches, and empty states with real reading signals.
          You can skip now and finish it later from Settings.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Taste", "Favorite genres and format", "taste"],
          ["Pace", "How often and how long you read", "pace"],
          ["Goals", "A target your dashboard can use", "goal"],
        ].map(([title, body, step]) => (
          <button
            key={title}
            type="button"
            onClick={() => onStepSelect(step as OnboardingStepId)}
            className="rounded-md bg-muted/35 p-3 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <p className="font-sans text-sm font-semibold">{title}</p>
            <p className="font-sans text-xs text-muted-foreground">{body}</p>
          </button>
        ))}
      </div>
    </div>

    <div className="mx-auto hidden w-full max-w-[17rem] lg:block">
      <img
        src={BRACK_STREAK_HAPPY_IMAGE}
        alt=""
        aria-hidden="true"
        className="aspect-square w-full object-contain drop-shadow-[0_18px_38px_hsl(var(--primary)/0.16)]"
      />
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

      <div className="flex flex-wrap gap-2">
        {GENRES.map((genre) => {
          const selected = formData.favoriteGenres.includes(genre);
          return (
            <button
              key={genre}
              type="button"
              onClick={() => onToggleGenre(genre)}
              className={cn(
                "rounded-full border px-3 py-2 font-sans text-sm transition-all",
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
          <Label>Slowest genre</Label>
          <Select
            value={formData.slowestGenre}
            onValueChange={(value) => onFieldChange("slowestGenre", value)}
          >
            <SelectTrigger>
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

        <div className="space-y-2">
          <Label>Preferred book length</Label>
          <div className="grid grid-cols-2 gap-2">
            {BOOK_LENGTH_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onFieldChange("preferredBookLength", option.value)}
                className={cn(
                  "rounded-md border p-3 text-left transition-colors",
                  formData.preferredBookLength === option.value
                    ? "border-primary bg-primary/12 text-primary"
                    : "border-border bg-background hover:bg-muted/60",
                )}
              >
                <span className="block font-sans text-sm font-semibold">{option.label}</span>
                <span className="block font-sans text-xs text-muted-foreground">{option.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>

    <div className="rounded-lg bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <APP_ICONS.readers.similarTaste className="h-5 w-5 text-primary" />
        <h3 className="font-display text-lg font-semibold">Taste constellation</h3>
      </div>
      <div ref={selectedGenresRef} className="flex min-h-40 flex-wrap content-start gap-2">
        {formData.favoriteGenres.length === 0 ? (
          <p className="font-sans text-sm text-muted-foreground">Selected genres fly here.</p>
        ) : (
          formData.favoriteGenres.map((genre) => (
            <Badge key={genre} className="selected-genre-chip">
              {genre}
              <Xmark className="ml-1 h-3 w-3" />
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
          <div>
            <Label className="font-sans text-base">Daily reminder</Label>
            <p className="font-sans text-sm text-muted-foreground">
              This seeds notification preferences; you can edit it later.
            </p>
          </div>
          <Switch
            checked={formData.reminderEnabled}
            onCheckedChange={(checked) => onFieldChange("reminderEnabled", checked)}
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
        className="mx-auto mb-4 h-36 w-36 rounded-md object-cover"
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
        className="mx-auto mb-4 h-36 w-36 rounded-md object-cover"
      />
      <p className="font-display text-xl font-bold">Ready to personalize</p>
      <p className="font-sans text-sm text-muted-foreground">
        Habits, goal, notification preference, and learning signals will be saved together.
      </p>
    </div>
  </div>
);

const VisualLearningCard = ({ formData }: { formData: OnboardingFormData }) => (
  <div className="rounded-lg border border-border/70 bg-card/80 p-4 backdrop-blur">
    <div className="mb-3 flex items-center gap-2">
      <APP_ICONS.dashboard.insights className="h-5 w-5 text-primary" />
      <h2 className="font-display text-lg font-semibold">Profile signal</h2>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <SignalMetric label="Genres" value={formData.favoriteGenres.length} />
      <SignalMetric label="Goal" value={formData.goalTargetBooks ?? 0} />
      <SignalMetric label="Minutes" value={formData.preferredSessionMinutes ?? 0} />
    </div>
  </div>
);

const SignalMetric = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-md border border-border/70 bg-background/75 p-3 text-center">
    <div className="font-sans text-xl font-bold text-primary">{value}</div>
    <div className="font-sans text-xs text-muted-foreground">{label}</div>
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
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="grid gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md border px-3 py-2 text-left font-sans text-sm transition-colors",
            value === option.value
              ? "border-primary bg-primary/12 text-primary"
              : "border-border bg-background hover:bg-muted/60",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
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
