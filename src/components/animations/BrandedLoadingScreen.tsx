import { useEffect, useState, useRef } from "react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { fadeIn } from "@/lib/animations/gsap-presets";
import { cn } from "@/lib/utils";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";
import { AnimatePresence, motion } from "framer-motion";

interface BrandedLoadingScreenProps {
  onComplete?: () => void;
  minDisplayTime?: number;
  progress?: number;
}

export const BrandedLoadingScreen = ({
  onComplete,
  minDisplayTime = 1500,
  progress,
}: BrandedLoadingScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const logoRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startTime = useRef(Date.now());

  useGSAP(() => {
    if (!logoRef.current || !textRef.current || !containerRef.current) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tl = gsap.timeline();

    if (prefersReducedMotion) {
      // Simpler animation for reduced motion
      tl.add(fadeIn(logoRef.current, { duration: 0.4 }));
      tl.add(fadeIn(textRef.current, { duration: 0.4 }), "-=0.2");
    } else {
      // Enhanced animation sequence
      // 1. Icon scale-in from 0.5 to 1.0 (back.out easing)
      gsap.set(logoRef.current, { scale: 0.5, opacity: 0 });
      tl.to(logoRef.current, {
        scale: 1,
        opacity: 1,
        duration: 0.6,
        ease: "back.out(1.7)",
      });

      // 2. Glow ring expands and pulses
      const glowRing = logoRef.current.querySelector('.glow-ring');
      if (glowRing) {
        gsap.set(glowRing, { scale: 0, opacity: 0 });
        tl.to(glowRing, {
          scale: 1.5,
          opacity: 0.6,
          duration: 0.8,
          ease: "power2.out",
        }, "-=0.3");
        // Continuous pulse
        gsap.to(glowRing, {
          scale: 1.6,
          opacity: 0.4,
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          ease: "power2.inOut",
        });
      }

      // 3. Text fades up
      gsap.set(textRef.current, { opacity: 0, y: 10 });
      tl.to(textRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power2.out",
      }, "-=0.2");

      // 4. Subtle breathe animation on icon (ongoing)
      gsap.to(logoRef.current, {
        scale: 1.05,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
      }, "-=0.5");
    }

    // Progress bar animation if provided
    if (progressRef.current && progress !== undefined) {
      tl.to(progressRef.current, {
        width: `${progress}%`,
        duration: 0.3,
        ease: "power2.out",
      }, "-=0.1");
    }
  }, { dependencies: [progress] });

  useEffect(() => {
    const elapsed = Date.now() - startTime.current;
    const remaining = Math.max(0, minDisplayTime - elapsed);

    const timer = setTimeout(() => {
      setIsVisible(false);
      // Call onComplete after exit animation completes (200ms from AnimatePresence)
      setTimeout(() => {
        onComplete?.();
      }, 200);
    }, remaining);

    return () => clearTimeout(timer);
  }, [minDisplayTime, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          className={cn(
            "fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center",
            "supports-[backdrop-filter]:bg-background/95 backdrop-blur-sm"
          )}
        >
      {/* Logo */}
      <div ref={logoRef} className="mb-6">
        <div className="relative">
          <ThemeAwareLogo
            variant="icon"
            size="h-20 w-20 md:h-24 md:w-24"
            className="drop-shadow-lg"
          />
          {/* Glow ring - synced to primary color from theme */}
          <div className="glow-ring absolute inset-0 bg-primary/30 rounded-full blur-xl -z-10" />
        </div>
      </div>

      {/* Loading Text */}
      <div ref={textRef} className="opacity-0">
        <p className="text-lg md:text-xl font-medium text-muted-foreground">
          Loading your reading journey...
        </p>
      </div>

      {/* Progress Bar */}
      {progress !== undefined && (
        <div className="mt-8 w-64 h-1 bg-muted rounded-full overflow-hidden">
          <div
            ref={progressRef}
            className="h-full bg-gradient-primary rounded-full"
            style={{ width: '0%' }}
          />
        </div>
      )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
