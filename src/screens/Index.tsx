import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Timer, StatsReport } from "iconoir-react";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/contexts/ThemeContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useGSAPTimeline } from "@/hooks/useGSAP";
import { gsap } from "gsap";

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const { resetToDefaultTheme } = useTheme();
  
  // Refs for GSAP animations
  const logoRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const subheadlineRef = useRef<HTMLParagraphElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const featureCardsRef = useRef<HTMLDivElement>(null);

  // Force default theme on landing page (only if not authenticated)
  useEffect(() => {
    const checkAndResetTheme = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // Only reset theme if user is not authenticated
      if (!session) {
        resetToDefaultTheme();
      }
    };
    checkAndResetTheme();
  }, [resetToDefaultTheme]);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setLoading(false);
      }
    };
    checkUser();
  }, [navigate]);

  // ── Reduced motion & slow connection detection ───────────────────────
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [useVideo, setUseVideo] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if ('connection' in navigator) {
      const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
      if (conn) {
        const effectiveType = conn.effectiveType;
        if (effectiveType === '2g' || effectiveType === 'slow-2g') {
          setUseVideo(false);
        }
      }
    }
  }, []);

  // GSAP Animations
  useGSAPTimeline(
    (tl) => {
      if (prefersReducedMotion) return;
      
      // Logo: fade in + scale up
      if (logoRef.current) {
        gsap.set(logoRef.current, { opacity: 0, scale: 0.8 });
        tl.to(logoRef.current, {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          ease: "back.out(1.7)",
        });
      }

      // Headline: slide up + fade
      if (headlineRef.current) {
        gsap.set(headlineRef.current, { opacity: 0, y: 30 });
        tl.to(
          headlineRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
          },
          "-=0.3"
        );
      }

      // Subheadline: fade in
      if (subheadlineRef.current) {
        gsap.set(subheadlineRef.current, { opacity: 0 });
        tl.to(
          subheadlineRef.current,
          {
            opacity: 1,
            duration: 0.6,
            ease: "power2.out",
          },
          "-=0.4"
        );
      }

      // Buttons: scale in with bounce (staggered)
      if (buttonsRef.current) {
        const buttons = buttonsRef.current.querySelectorAll("button");
        gsap.set(buttons, { opacity: 0, scale: 0.9 });
        tl.to(
          buttons,
          {
            opacity: 1,
            scale: 1,
            duration: 0.5,
            ease: "back.out(1.4)",
            stagger: 0.1,
          },
          "-=0.2"
        );
      }

      // Feature cards: staggered fade in + slide up
      if (featureCardsRef.current) {
        const cards = featureCardsRef.current.children;
        gsap.set(cards, { opacity: 0, y: 40 });
        tl.to(
          cards,
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            stagger: 0.2,
          },
          "-=0.1"
        );
      }
    },
    { dependencies: [loading, prefersReducedMotion] }
  );

  // ── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-background relative overflow-x-hidden overflow-y-auto">
      {/* Light / Dark toggle */}
      <ThemeToggle />

      {/* ── Video Background (fixed so it stays behind while scrolling) */}
      {!prefersReducedMotion && useVideo && (
        <div className="fixed inset-0 overflow-hidden z-0">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
            onLoadedData={() => setVideoLoaded(true)}
            onError={() => setUseVideo(false)}
            style={{ opacity: videoLoaded ? 0.25 : 0 }}
          >
            <source src="/brack-landing-bg-video.mp4" type="video/mp4" />
          </video>
          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/60 to-background/90" />
        </div>
      )}

      {/* ── Animated blobs (fixed behind content) ────────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-20 right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-primary-glow/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      </div>
      
      {/* ── Hero Section ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center px-4 pt-20 pb-16 relative z-10 safe-top safe-bottom">
        <div className="text-center max-w-5xl mx-auto space-y-10 md:space-y-12">
          
          {/* Logo — theme-aware full logo (icon + BRACK text) */}
          <div ref={logoRef} className="flex justify-center mb-8">
            <ThemeAwareLogo
              variant="full"
              size="h-28 md:h-36"
              className="drop-shadow-xl"
            />
          </div>
          
          {/* Main Heading */}
          <div ref={headlineRef} className="space-y-5">
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
              Turn Every Page Into
              <br />
              <span className="bg-gradient-primary bg-clip-text text-transparent text-5xl md:text-7xl lg:text-8xl">Progress</span>
            </h1>
            <p ref={subheadlineRef} className="font-serif text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Master your reading life. Transform pages into progress with elegant data and forge deep connections. 
              Cement your habits online or offline.
            </p>
          </div>
          
          {/* CTA Buttons — Sign In + Sign Up */}
          <div ref={buttonsRef} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Button 
              onClick={() => navigate("/auth?mode=signup")}
              className="w-full sm:w-auto text-lg px-10 py-6 h-auto bg-gradient-primary hover:shadow-glow transition-all duration-300 text-white font-medium rounded-2xl"
            >
              Get Started
            </Button>
            <Button 
              onClick={() => navigate("/auth?mode=signin")}
              variant="outline"
              className="w-full sm:w-auto text-lg px-10 py-6 h-auto border-border/50 hover:shadow-soft transition-all duration-300 font-medium rounded-2xl"
            >
              Sign In
            </Button>
          </div>
          
          {/* Features Grid */}
          <div ref={featureCardsRef} className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mt-16 md:mt-20">
            <Card className="text-center bg-gradient-card shadow-soft border-0 p-4 md:p-6 hover:shadow-medium transition-all duration-300 group">
              <CardContent className="p-4 md:p-6">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:shadow-glow transition-all duration-300">
                  <Trophy className="h-7 w-7 md:h-8 md:w-8 text-white" />
                </div>
                <CardTitle className="font-display text-lg md:text-xl mb-3 md:mb-4 text-foreground">Set Goals</CardTitle>
                <CardDescription className="font-serif text-muted-foreground leading-relaxed text-sm md:text-base">
                  Build reading habits that stick. Set yearly goals, track daily progress, and watch your streaks grow.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card className="text-center bg-gradient-card shadow-soft border-0 p-4 md:p-6 hover:shadow-medium transition-all duration-300 group">
              <CardContent className="p-4 md:p-6">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:shadow-glow transition-all duration-300">
                  <Timer className="h-7 w-7 md:h-8 md:w-8 text-white" />
                </div>
                <CardTitle className="font-display text-lg md:text-xl mb-3 md:mb-4 text-foreground">Track Time</CardTitle>
                <CardDescription className="font-serif text-muted-foreground leading-relaxed text-sm md:text-base">
                  Every minute counts. Use our reading timer to log sessions, discover your pace, and see how time adds up.
                </CardDescription>
              </CardContent>
            </Card>
            
            <Card className="text-center bg-gradient-card shadow-soft border-0 p-4 md:p-6 hover:shadow-medium transition-all duration-300 group">
              <CardContent className="p-4 md:p-6">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:shadow-glow transition-all duration-300">
                  <StatsReport className="h-7 w-7 md:h-8 md:w-8 text-white" />
                </div>
                <CardTitle className="font-display text-lg md:text-xl mb-3 md:mb-4 text-foreground">Analyze Progress</CardTitle>
                <CardDescription className="font-serif text-muted-foreground leading-relaxed text-sm md:text-base">
                  Turn reading into insights. See your velocity, genre preferences, and completion rates in beautiful charts.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
