import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import LoadingSpinner from "@/components/LoadingSpinner";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { LandingIllustration, LandingSentenceReveal } from "@/components/marketing/LandingEditorialArt";
import { LandingGamificationShowcase } from "@/components/marketing/LandingGamificationShowcase";
import { LandingReveal } from "@/components/marketing/LandingReveal";
import { LandingReadingStepArt } from "@/components/marketing/LandingReadingStepArt";
import { LandingStoreBadges } from "@/components/marketing/LandingStoreBadges";
import { LandingTypewriter } from "@/components/marketing/LandingTypewriter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { useTheme } from "@/contexts/ThemeContext";
import { getAuthSession } from "@/services/api";
import { resolvePostAuthPath } from "@/services/authRedirect";
import { clearOnboardingDraft } from "@/services/onboardingDraft";

const landingPrimaryCtaClass =
  "h-auto max-w-full whitespace-normal rounded-lg border border-primary bg-primary py-3 text-center font-semibold leading-snug text-[#251407] shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.28),0_4px_0_hsl(var(--foreground)/0.22),0_12px_24px_-15px_hsl(var(--primary)/0.9)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-px hover:bg-primary hover:shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.32),0_5px_0_hsl(var(--foreground)/0.22),0_15px_26px_-15px_hsl(var(--primary)/0.9)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.2),0_1px_0_hsl(var(--foreground)/0.2),0_5px_12px_-10px_hsl(var(--primary)/0.75)] motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0";

const landingQuietCtaClass =
  "h-auto max-w-full whitespace-normal rounded-lg border border-foreground/25 bg-card py-3 text-center font-semibold leading-snug text-foreground shadow-[inset_0_1px_0_hsl(var(--background)/0.7),0_3px_0_hsl(var(--foreground)/0.12),0_10px_22px_-16px_hsl(var(--foreground)/0.5)] transition-[transform,box-shadow,background-color,border-color] duration-200 hover:-translate-y-px hover:border-foreground/35 hover:bg-accent hover:text-foreground active:translate-y-[2px] active:shadow-[inset_0_1px_0_hsl(var(--background)/0.55),0_1px_0_hsl(var(--foreground)/0.12)] motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0";

const productIndex = [
  { number: "01", label: "Library", detail: "Books, pages, notes" },
  { number: "02", label: "Ritual", detail: "Sessions, streaks, goals" },
  { number: "03", label: "Journey", detail: "Quests, Ink, Gold Leaves" },
  { number: "04", label: "Circle", detail: "Reviews, readers, book clubs" },
] as const;

const readingDay = [
  {
    step: "resume",
    marker: "08:12",
    chapter: "Resume",
    title: "Open the book that is already in motion.",
    description:
      "Brack keeps the title, page, and reading history together, so returning takes one tap instead of a search.",
  },
  {
    step: "record",
    marker: "12:40",
    chapter: "Record",
    title: "Log pages or minutes without leaving the moment.",
    description:
      "Use a timer or update the page directly. If the connection disappears, the core reading flow keeps working.",
  },
  {
    step: "understand",
    marker: "Sunday",
    chapter: "Understand",
    title: "See what a week of reading actually became.",
    description:
      "Review pace, consistency, goals, genres, and finished books without turning reading into a spreadsheet.",
  },
] as const;

const circleIndex = [
  {
    number: "01",
    title: "Reviews",
    copy: "Keep the thought beside the book that caused it.",
  },
  {
    number: "02",
    title: "Readers",
    copy: "Follow people whose shelves make you curious.",
  },
  {
    number: "03",
    title: "Book clubs",
    copy: "Give a shared read one place for context and conversation.",
  },
] as const;

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { resetToDefaultTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    let active = true;

    const prepareLanding = async () => {
      try {
        const session = await getAuthSession();
        if (!active) return;

        if (session) {
          navigate(await resolvePostAuthPath(), { replace: true });
          return;
        }

        clearOnboardingDraft();
        resetToDefaultTheme();
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void prepareLanding();
    return () => {
      active = false;
    };
  }, [navigate, resetToDefaultTheme]);

  if (loading) {
    return (
      <div className="flex min-h-app-viewport items-center justify-center bg-background">
        <LoadingSpinner size="lg" text="Opening Brack..." />
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";
  const libraryPreview = isDark
    ? "/landing-page/landing-page-pic-dark.png"
    : "/landing-page/landing-page-pic-light.png";
  const previewMode = isDark ? "dark" : "light";

  return (
    <div className="relative min-h-app-viewport overflow-x-clip bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-transform duration-200 focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b border-border bg-background/95 supports-[backdrop-filter]:backdrop-blur-md">
        <div className="safe-top mx-auto flex min-h-16 w-full max-w-7xl items-center gap-4 px-4 py-2 sm:px-6 lg:px-8">
          <Link
            to="/"
            aria-label="Brack home"
            className="flex min-h-11 min-w-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ThemeAwareLogo variant="full" size="h-9 sm:h-10" />
          </Link>

          <nav
            className="ml-auto hidden items-center gap-7 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:flex"
            aria-label="Landing page"
          >
            <a
              className="border-b border-transparent py-2 transition-colors duration-200 hover:border-primary hover:text-foreground"
              href="#experience"
            >
              The app
            </a>
            <a
              className="border-b border-transparent py-2 transition-colors duration-200 hover:border-primary hover:text-foreground"
              href="#how-it-works"
            >
              The method
            </a>
            <a
              className="border-b border-transparent py-2 transition-colors duration-200 hover:border-primary hover:text-foreground"
              href="#journey"
            >
              The journey
            </a>
            <a
              className="border-b border-transparent py-2 transition-colors duration-200 hover:border-primary hover:text-foreground"
              href="#community"
            >
              The circle
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-1.5 lg:ml-5 sm:gap-2">
            <ThemeToggle variant="inline" />
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={`hidden min-h-11 px-4 sm:inline-flex ${landingQuietCtaClass}`}
            >
              <Link to="/auth?mode=signin">Sign in</Link>
            </Button>
            <Button size="sm" asChild className={`min-h-11 px-4 sm:px-5 ${landingPrimaryCtaClass}`}>
              <Link to="/onboarding?from=landing">
                <span className="hidden sm:inline">Get started</span>
                <span className="sm:hidden">Start</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="landing-hero border-b border-border">
          <picture className="landing-hero__photograph" aria-hidden="true">
            <source media="(max-width: 640px)" srcSet="/landing-page/sunset-reading-hero-mobile.webp" />
            <img
              src="/landing-page/sunset-reading-hero.webp"
              alt=""
              width={1600}
              height={900}
              fetchPriority="high"
              decoding="async"
            />
          </picture>
          <div className="landing-hero__shade" aria-hidden="true" />
          <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex min-w-0 flex-col justify-center px-5 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-24 lg:pr-16">
              <LandingReveal distance={12}>
                <p className="landing-hero__eyebrow font-mono text-xs font-semibold uppercase tracking-[0.18em]">
                  Brack / a record for readers
                </p>
              </LandingReveal>
              <h1 className="mt-7 max-w-[10ch] font-display text-[clamp(3.5rem,8.4vw,7.8rem)] font-bold leading-[0.88] tracking-[-0.06em]">
                <LandingTypewriter text="A reading life deserves a record." />
              </h1>
              <LandingReveal className="mt-8" delay={0.05}>
                <p className="landing-hero__description max-w-2xl font-serif text-lg leading-relaxed sm:text-xl lg:text-2xl">
                  Brack keeps your books, pages, minutes, notes, goals, and reading circles in one place without turning
                  reading into admin.
                </p>
              </LandingReveal>
              <LandingReveal className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center" delay={0.1}>
                <Button asChild className={`h-14 px-7 text-base ${landingPrimaryCtaClass}`}>
                  <Link to="/onboarding?from=landing">Begin with your shelf</Link>
                </Button>
                <Button variant="ghost" asChild className="landing-hero__secondary h-14 px-6 text-sm font-semibold">
                  <Link to="/auth?mode=signin">Sign in to my account</Link>
                </Button>
              </LandingReveal>
              <LandingReveal className="mt-5" delay={0.15} distance={12}>
                <p className="landing-hero__note max-w-lg text-sm leading-relaxed">
                  Start with a short reading profile. Create your account only after Brack feels like yours.
                </p>
              </LandingReveal>
            </div>

            <aside
              className="landing-hero__index flex flex-col justify-between border-t px-5 py-8 sm:px-6 lg:border-l lg:border-t-0 lg:px-8 lg:py-12"
              aria-label="Brack product index"
            >
              <div>
                <LandingReveal
                  distance={12}
                  className="landing-hero__index-title flex items-center justify-between gap-4 border-b pb-4 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em]"
                >
                  <span>Reader&apos;s index</span>
                  <span className="landing-hero__index-number">Issue 01</span>
                </LandingReveal>
                <ol>
                  {productIndex.map(({ number, label, detail }, index) => (
                    <li key={number}>
                      <LandingReveal
                        delay={index * 0.05}
                        distance={12}
                        className="landing-hero__index-row grid grid-cols-[2.5rem_1fr] gap-3 border-b py-5"
                      >
                        <span className="landing-hero__index-number font-mono text-xs">{number}</span>
                        <div>
                          <p className="font-display text-xl font-semibold">{label}</p>
                          <p className="landing-hero__note mt-1 text-sm">{detail}</p>
                        </div>
                      </LandingReveal>
                    </li>
                  ))}
                </ol>
              </div>
              <LandingReveal className="landing-hero__index-note mt-12 lg:mt-8" distance={12}>
                <p className="landing-hero__description max-w-[24rem] border-l-2 border-primary pl-4 font-serif text-sm leading-6">
                  Online when you want connection. Useful offline when you only want the book.
                </p>
              </LandingReveal>
            </aside>
          </div>
        </section>

        <ContainerScroll
          id="experience"
          className="scroll-mt-20"
          footerComponent={<LandingStoreBadges />}
          titleComponent={
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                The library / 01
              </p>
              <h2 className="mx-auto mt-5 max-w-[13ch] font-display text-[clamp(2.7rem,6.4vw,5.8rem)] font-bold leading-[0.94] tracking-[-0.05em]">
                Your library, not another feed.
              </h2>
              <p className="mx-auto mt-6 max-w-72 text-base leading-relaxed text-muted-foreground sm:max-w-lg sm:text-lg">
                Search the shelf, resume a book, update a page, or step back and read the pattern.
              </p>
            </div>
          }
        >
          <img
            key={libraryPreview}
            src={libraryPreview}
            alt={"Brack Library showing reading progress in " + previewMode + " mode"}
            width={isDark ? 612 : 613}
            height={842}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full select-none object-contain"
          />
        </ContainerScroll>

        <section id="how-it-works" className="landing-tint landing-tint--sand scroll-mt-24 border-y border-border">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <div className="landing-method__intro">
              <div className="landing-method__art">
                <LandingReveal className="landing-method__label" distance={12}>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    A reading day / 02
                  </p>
                </LandingReveal>
                <LandingIllustration kind="book" />
              </div>
              <div>
                <h2 className="max-w-[15ch] font-display text-4xl font-bold leading-[0.98] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                  <LandingSentenceReveal text="The record should stay out of the way of the reading." />
                </h2>
                <LandingReveal className="mt-6" delay={0.08}>
                  <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    Brack follows the moments that already exist: picking up a book, marking progress, and looking back.
                  </p>
                </LandingReveal>
              </div>
            </div>

            <ol className="landing-reading-day mt-10 border-t border-foreground sm:mt-14">
              {readingDay.map(({ step, marker, chapter, title, description }) => (
                <li key={marker} className="border-b border-border">
                  <LandingReveal
                    distance={10}
                    className="landing-reading-day__row"
                  >
                    <div className="landing-reading-day__cue">
                      <span className="landing-reading-day__marker font-mono text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                        {marker}
                      </span>
                      <LandingReadingStepArt step={step} />
                    </div>
                    <div>
                      <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {chapter}
                      </p>
                      <h3 className="mt-2 max-w-md font-display text-2xl font-semibold leading-tight sm:text-3xl">
                        {title}
                      </h3>
                    </div>
                    <p className="landing-reading-day__description max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">{description}</p>
                  </LandingReveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="journey" className="scroll-mt-24">
          <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.42fr_0.58fr] lg:gap-16">
              <LandingReveal distance={12}>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  The journey / 03
                </p>
              </LandingReveal>
              <div>
                <h2 className="max-w-[13ch] font-display text-4xl font-bold leading-[0.98] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                  <LandingSentenceReveal text="Progress can have a little life in it." />
                </h2>
                <LandingReveal className="mt-6" delay={0.08}>
                  <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    Streaks show the state of the habit. Lifetime Ink records experience. Gold Leaves can be spent. Each
                    has one clear job.
                  </p>
                </LandingReveal>
              </div>
            </div>

            <LandingReveal delay={0.07} distance={12}>
              <LandingGamificationShowcase />
            </LandingReveal>
          </div>
        </section>

        <section id="community" className="landing-tint landing-tint--linen scroll-mt-24 border-y border-border">
          <div className="mx-auto grid w-full max-w-7xl lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="px-4 py-20 sm:px-6 sm:py-28 lg:border-r lg:border-border lg:px-8 lg:pr-16">
              <div>
                <LandingReveal distance={12}>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    The circle / 04
                  </p>
                </LandingReveal>
                <h2 className="mt-7 max-w-[15ch] font-display text-4xl font-bold leading-[0.98] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                  <LandingSentenceReveal text="Keep the solitary part. Share only when it adds something." />
                </h2>
                <LandingReveal className="mt-7" delay={0.08}>
                  <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    Your library can remain a private record. When you want company, Brack keeps the conversation attached
                    to books, readers, and clubs instead of a generic social feed.
                  </p>
                </LandingReveal>
                <LandingReveal className="mt-10" delay={0.12} distance={12}>
                  <p className="max-w-xl border-l-2 border-primary pl-5 font-serif text-base leading-7 text-foreground">
                    The core reading flow remains useful offline. Connection is an addition, not a condition.
                  </p>
                </LandingReveal>
              </div>
            </div>

            <aside
              className="border-t border-border px-4 py-10 sm:px-6 lg:border-t-0 lg:px-8 lg:py-20"
              aria-label="Community features"
            >
              <LandingIllustration kind="circle" className="landing-community-art" />
              <div className="border-t border-foreground">
                {circleIndex.map(({ number, title, copy }, index) => (
                  <LandingReveal
                    key={number}
                    delay={index * 0.05}
                    distance={12}
                    className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-border py-6"
                  >
                    <span className="font-mono text-xs text-primary">{number}</span>
                    <div>
                      <h3 className="font-display text-xl font-semibold">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p>
                    </div>
                  </LandingReveal>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="landing-tint landing-tint--sunset px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-16">
            <div>
              <LandingReveal distance={12}>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Begin before the account
                </p>
              </LandingReveal>
              <h2 className="mt-7 max-w-[14ch] font-display text-4xl font-bold leading-[0.98] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                <LandingSentenceReveal text="Tell Brack how you read. Sign up when it feels like yours." />
              </h2>
            </div>
            <LandingReveal delay={0.1}>
              <p className="text-sm leading-7 text-muted-foreground">
                Choose your palette, taste, pace, and first goal. Those choices become your profile after signup.
              </p>
              <Button asChild className={`mt-7 h-14 w-full px-7 text-base ${landingPrimaryCtaClass}`}>
                <Link to="/onboarding?from=landing">Start the reading profile</Link>
              </Button>
            </LandingReveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <LandingReveal distance={12}>
            <ThemeAwareLogo variant="full" size="h-8" />
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              A considered record for the books, habits, and people that shape a reading life.
            </p>
          </LandingReveal>
          <LandingReveal
            delay={0.05}
            distance={12}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            <a href="#experience" className="transition-colors duration-200 hover:text-foreground">
              The app
            </a>
            <a href="#how-it-works" className="transition-colors duration-200 hover:text-foreground">
              The method
            </a>
            <Link to="/auth?mode=signin" className="transition-colors duration-200 hover:text-foreground">
              Sign in
            </Link>
            <a href="mailto:support@brack-app.com" className="transition-colors duration-200 hover:text-foreground">
              Support
            </a>
          </LandingReveal>
        </div>
      </footer>
    </div>
  );
};

export default Index;
