import { useCallback, useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { gsap } from "gsap";
import { BRACK_STREAK_HAPPY_IMAGE } from "@/config/brackAssets";
import { useGSAP } from "@/hooks/useGSAP";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export const STREAK_CELEBRATION_DURATION_MS = 2_000;
/** Other celebration observers can use this marker to queue instead of overlap. */
export const ACTIVE_BRACK_CELEBRATION_SELECTOR = "[data-brack-celebration-active]";

interface StreakCelebrationOverlayProps {
  open: boolean;
  streak: number;
  onDismiss: () => void;
  /** Exposed for deterministic tests and previews; production uses two seconds. */
  durationMs?: number;
}

const SPARK_VECTORS = [
  [-132, -80],
  [-82, -142],
  [-18, -164],
  [54, -150],
  [120, -96],
  [142, -20],
  [124, 66],
  [70, 126],
  [0, 148],
  [-74, 124],
  [-132, 62],
  [-148, -12],
] as const;

const safeStreak = (streak: number) => (
  Number.isFinite(streak) ? Math.max(1, Math.trunc(streak)) : 1
);

/**
 * A short, spatial streak reveal. This is intentionally controlled: callers
 * decide when a server-confirmed streak transition is new enough to celebrate.
 */
export const StreakCelebrationOverlay = ({
  open,
  streak,
  onDismiss,
  durationMs = STREAK_CELEBRATION_DURATION_MS,
}: StreakCelebrationOverlayProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const onDismissRef = useRef(onDismiss);
  const dismissedRef = useRef(false);
  const hapticPlayedRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previousOpenRef = useRef(false);
  const reducedMotion = useReducedMotion();
  const { triggerHaptic } = useHapticFeedback();
  const count = safeStreak(streak);

  if (open && !previousOpenRef.current && typeof document !== "undefined") {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  }
  previousOpenRef.current = open;

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    const previousFocus = previousFocusRef.current;
    onDismissRef.current();
    window.setTimeout(() => {
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus({ preventScroll: true });
      }
    }, 0);
  }, []);

  useEffect(() => {
    if (!open) {
      hapticPlayedRef.current = false;
      return;
    }
    if (reducedMotion || hapticPlayedRef.current) return;

    hapticPlayedRef.current = true;
    void triggerHaptic("success");
  }, [open, reducedMotion, triggerHaptic]);

  useEffect(() => {
    if (!open) return undefined;

    dismissedRef.current = false;
    const timer = window.setTimeout(dismiss, Math.max(0, durationMs));

    return () => {
      window.clearTimeout(timer);
    };
  }, [dismiss, durationMs, open]);

  useGSAP(() => {
    const overlay = overlayRef.current;
    const stage = stageRef.current;
    const glow = glowRef.current;
    const copy = copyRef.current;
    if (!open || reducedMotion || !overlay || !stage || !glow || !copy) return;

    const reveal = gsap.timeline();
    reveal
      .fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "power1.out" })
      .fromTo(
        glow,
        { opacity: 0, scale: 0.25 },
        { opacity: 0.82, scale: 1, duration: 0.5, ease: "power2.out" },
        0.04,
      )
      .fromTo(
        stage,
        {
          opacity: 0,
          scale: 0.2,
          y: 88,
          z: -420,
          rotationX: 34,
          rotationY: -24,
        },
        {
          opacity: 1,
          scale: 1.14,
          y: -8,
          z: 96,
          rotationX: -5,
          rotationY: 7,
          duration: 0.58,
          ease: "back.out(1.85)",
        },
        0.02,
      )
      .to(stage, {
        scale: 1,
        y: 0,
        z: 42,
        rotationX: 0,
        rotationY: 0,
        duration: 0.24,
        ease: "power2.out",
      })
      .fromTo(
        copy,
        { opacity: 0, y: 16, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: "power2.out" },
        0.34,
      )
      .to(stage, {
        y: -7,
        rotationY: -2.5,
        duration: 0.34,
        ease: "sine.inOut",
      }, 0.86)
      .to(stage, {
        y: 0,
        rotationY: 2,
        duration: 0.34,
        ease: "sine.inOut",
      }, 1.2)
      .to([stage, glow], {
        opacity: 0,
        scale: 0.84,
        z: -100,
        duration: 0.24,
        ease: "power2.in",
      }, 1.7)
      .to(copy, { opacity: 0, y: -8, duration: 0.18, ease: "power1.in" }, 1.72)
      .to(overlay, { opacity: 0, duration: 0.2, ease: "power1.in" }, 1.76);

    overlay.querySelectorAll<HTMLElement>("[data-streak-spark]").forEach((spark, index) => {
      const [x, y] = SPARK_VECTORS[index] ?? [0, -120];
      gsap.fromTo(
        spark,
        { opacity: 0, scale: 0, x: 0, y: 0, rotation: 0 },
        {
          opacity: 0,
          scale: index % 3 === 0 ? 1.35 : 0.85,
          x,
          y,
          rotation: index % 2 === 0 ? 135 : -110,
          duration: 0.82,
          delay: 0.2 + (index % 4) * 0.035,
          ease: "power2.out",
          keyframes: [
            { opacity: 0, scale: 0 },
            { opacity: 0.9, scale: 1, duration: 0.2 },
            { opacity: 0, scale: 0.7, duration: 0.62 },
          ],
        },
      );
    });

    return reveal;
  }, { dependencies: [open, reducedMotion] });

  if (typeof document === "undefined") return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => !nextOpen && dismiss()}>
      <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[10019] bg-background/90" />
          <DialogPrimitive.Content
      ref={overlayRef}
      className="fixed inset-0 z-[10020] flex h-[100dvh] w-screen touch-manipulation cursor-pointer items-center justify-center overflow-hidden px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-foreground backdrop-blur-[3px]"
      style={{
        background: "radial-gradient(circle at 50% 43%, hsl(var(--primary) / 0.22) 0%, hsl(var(--background) / 0.74) 48%, hsl(var(--background) / 0.9) 100%)",
      }}
      onClick={dismiss}
      data-testid="streak-celebration-overlay"
      data-motion={reducedMotion ? "reduced" : "full"}
      data-brack-celebration-active="streak"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
      }}
    >
      <DialogPrimitive.Title className="sr-only">
        Daily reading streak completed
      </DialogPrimitive.Title>
      <DialogPrimitive.Description className="sr-only">
        Your {count} day reading streak is secure.
      </DialogPrimitive.Description>

      <DialogPrimitive.Close asChild>
        <button
          type="button"
          className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-full bg-background/75 font-sans text-2xl leading-none text-foreground shadow-soft outline-none backdrop-blur-sm transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          aria-label="Dismiss streak celebration"
          onClick={dismiss}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </DialogPrimitive.Close>

      <span
        className="relative flex w-full max-w-lg flex-col items-center"
        style={{ perspective: "1000px" }}
        data-testid="streak-celebration-stage-perspective"
        aria-hidden="true"
      >
        <span
          ref={glowRef}
          className="pointer-events-none absolute left-1/2 top-[38%] h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-3xl sm:h-72 sm:w-72"
        />

        {!reducedMotion && SPARK_VECTORS.map((_, index) => (
          <span
            // The fixed vectors make the burst lively while keeping it testable.
            key={index}
            data-streak-spark
            className={`pointer-events-none absolute left-1/2 top-[38%] h-2 w-2 rounded-sm ${
              index % 3 === 0
                ? "bg-primary"
                : index % 3 === 1
                  ? "bg-primary-glow"
                  : "bg-foreground"
            }`}
          />
        ))}

        <span
          ref={stageRef}
          className="relative z-10 block"
          style={{
            transformStyle: "preserve-3d",
            willChange: reducedMotion ? undefined : "transform, opacity",
          }}
          data-testid="streak-celebration-flame-stage"
        >
          <span className="pointer-events-none absolute bottom-[8%] left-1/2 h-[12%] w-[72%] -translate-x-1/2 rounded-[50%] bg-primary/30 blur-xl" />
          <img
            src={BRACK_STREAK_HAPPY_IMAGE}
            alt=""
            className="relative block aspect-square object-contain"
            style={{
              width: "clamp(11rem, 52vw, 20rem)",
              filter: "drop-shadow(0 1.5rem 1.35rem hsl(var(--primary) / 0.28)) drop-shadow(0 0 1.25rem hsl(var(--primary-glow) / 0.24))",
            }}
            decoding="async"
            draggable={false}
          />
        </span>

        <span ref={copyRef} className="relative z-20 -mt-2 block text-center sm:-mt-4">
          <span className="block font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Streak secured!
          </span>
          <span className="mt-1 block font-sans text-base font-semibold tabular-nums text-primary sm:text-lg">
            {count}-day flame
          </span>
          <span className="mt-2 block font-sans text-xs text-muted-foreground sm:text-sm">
            Tap anywhere or press Escape to continue
          </span>
        </span>
      </span>
          </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
