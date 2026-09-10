import { AnimatePresence, motion } from "framer-motion";
import { useState, type MouseEvent } from "react";

import {
  BRACK_GOLD_LEAVES_ICON_IMAGE,
  BRACK_LIFETIME_INK_ICON_IMAGE,
  BRACK_STREAK_HAPPY_IMAGE,
  BRACK_STREAK_SAD_IMAGE,
} from "@/config/brackAssets";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type FlameMood = "happy" | "sad";

const artButtonClass =
  "group relative mx-auto flex min-h-44 w-full min-w-0 max-w-52 touch-manipulation items-center justify-center rounded-2xl bg-transparent p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:min-h-52";

export const LandingGamificationShowcase = () => {
  const [flameMood, setFlameMood] = useState<FlameMood>("happy");
  const [inkCycle, setInkCycle] = useState(0);
  const [leavesCycle, setLeavesCycle] = useState(0);
  const [flamePointerActivation, setFlamePointerActivation] = useState(false);
  const [inkPointerActivation, setInkPointerActivation] = useState(false);
  const [leavesPointerActivation, setLeavesPointerActivation] = useState(false);
  const reducedMotion = useReducedMotion();
  const { triggerHaptic } = useHapticFeedback();
  const animateFlame = flamePointerActivation && !reducedMotion;
  const animateInkArt = inkPointerActivation && !reducedMotion;
  const animateLeavesArt = leavesPointerActivation && !reducedMotion;

  const isSad = flameMood === "sad";
  const flameImage = isSad ? BRACK_STREAK_SAD_IMAGE : BRACK_STREAK_HAPPY_IMAGE;

  const toggleFlameMood = (event: MouseEvent<HTMLButtonElement>) => {
    // Keyboard and assistive-technology button activations have detail === 0.
    setFlamePointerActivation(event.detail > 0);
    setFlameMood((current) => (current === "happy" ? "sad" : "happy"));
    void triggerHaptic("selection");
  };

  const animateInk = (event: MouseEvent<HTMLButtonElement>) => {
    setInkPointerActivation(event.detail > 0);
    setInkCycle((cycle) => cycle + 1);
    void triggerHaptic("light");
  };

  const animateLeaves = (event: MouseEvent<HTMLButtonElement>) => {
    setLeavesPointerActivation(event.detail > 0);
    setLeavesCycle((cycle) => cycle + 1);
    void triggerHaptic("light");
  };

  return (
    <div className="mt-14 grid grid-cols-1 border-y border-border sm:mt-20 lg:grid-cols-[1.1fr_0.9fr]">
      <figure className="grid min-h-[22rem] min-w-0 grid-cols-1 items-center gap-6 py-10 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-8 sm:py-12 lg:border-r lg:border-border lg:pr-12">
        <button
          type="button"
          aria-label="Preview missed-day streak state"
          aria-pressed={isSad}
          data-motion={animateFlame ? "animated" : "instant"}
          onClick={toggleFlameMood}
          className={artButtonClass}
        >
          <span className="relative flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
            <AnimatePresence initial={false} mode={animateFlame ? "wait" : "sync"} custom={animateFlame}>
              <motion.img
                key={flameMood}
                src={flameImage}
                alt=""
                width={256}
                height={256}
                loading="lazy"
                decoding="async"
                initial={
                  !animateFlame
                    ? false
                    : isSad
                    ? { opacity: 0, y: -3, scale: 1, rotate: 2 }
                    : { opacity: 0, y: 8, scale: 0.9, rotate: -3 }
                }
                animate={
                  !animateFlame
                    ? { opacity: 1, y: 0, scale: 1, rotate: 0 }
                    : isSad
                    ? {
                        opacity: 1,
                        y: [-3, 6, 3],
                        scale: [1, 0.94, 0.97],
                        rotate: [2, -2, 0],
                      }
                    : {
                        opacity: 1,
                        y: [8, -5, 0],
                        scale: [0.9, 1.06, 1],
                        rotate: [-3, 2, 0],
                      }
                }
                exit="leave"
                variants={{
                  // Presence receives the newest activation even though this
                  // image may already be exiting with its previous props.
                  leave: (allowMotion: boolean) => ({
                    opacity: allowMotion ? 0 : 1,
                    scale: allowMotion ? 0.97 : 1,
                    transition: { duration: allowMotion ? 0.14 : 0 },
                  }),
                }}
                transition={{
                  duration: animateFlame ? 0.5 : 0,
                  times: [0, 0.62, 1],
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="absolute h-full w-full object-contain drop-shadow-[0_28px_24px_hsl(var(--foreground)/0.16)]"
              />
            </AnimatePresence>
          </span>
        </button>

        <figcaption>
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-primary">
            Reading streak / {isSad ? "day missed" : "day kept"}
          </p>
          <h3 className="mt-3 font-display text-3xl font-semibold leading-tight">The flame has a mood.</h3>
          <p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">
            {isSad
              ? "A missed day looks disappointed, not defeated. The rest of the reading life stays intact."
              : "A day kept earns a small celebration. Tap the flame to see how it handles a missed one."}
          </p>
          <p className="mt-4 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-foreground/65">
            Tap the flame to change its mood
          </p>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {isSad ? "Showing the sad missed-day flame" : "Showing the happy reading-streak flame"}
          </span>
        </figcaption>
      </figure>

      <div className="grid min-w-0 grid-cols-1 border-t border-border sm:grid-cols-2 lg:border-t-0">
        <figure className="flex min-h-[19rem] flex-col justify-between py-9 sm:border-r sm:border-border sm:px-8 lg:px-10">
          <button
            type="button"
            aria-label="Animate Lifetime Ink"
            data-motion={animateInkArt ? "animated" : "instant"}
            onClick={animateInk}
            className={artButtonClass}
          >
            <span className="relative flex h-40 w-40 items-center justify-center [perspective:700px]">
              <motion.img
                key={`ink-${inkCycle}`}
                src={BRACK_LIFETIME_INK_ICON_IMAGE}
                alt=""
                width={256}
                height={256}
                loading="lazy"
                decoding="async"
                initial={false}
                animate={
                  inkCycle > 0 && animateInkArt
                    ? {
                        y: [0, -6, 1, 0],
                        rotate: [0, -2, 2, 0],
                        scale: [1, 1.025, 0.995, 1],
                      }
                    : { y: 0, rotate: 0, scale: 1 }
                }
                transition={{
                  duration: animateInkArt ? 0.62 : 0,
                  times: [0, 0.35, 0.72, 1],
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="h-32 w-32 object-contain drop-shadow-[0_24px_20px_hsl(var(--foreground)/0.16)]"
                style={{ transformOrigin: "50% 90%" }}
              />
              {inkCycle > 0 && animateInkArt ? (
                <motion.span
                  key={`ink-stroke-${inkCycle}`}
                  aria-hidden="true"
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: [0, 0.75, 0], scaleX: [0, 1, 1] }}
                  transition={{ duration: 0.58, times: [0, 0.46, 1], ease: "easeOut" }}
                  className="absolute bottom-3 left-1/2 h-px w-16 -translate-x-1/2 origin-left bg-foreground/70"
                />
              ) : null}
            </span>
          </button>
          <figcaption className="mt-5 border-t border-border pt-5">
            <p className="font-display text-xl font-semibold">Lifetime Ink</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Experience earned across the reading journey.
            </p>
            <p className="mt-3 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-foreground/60">
              Press to stir the ink
            </p>
          </figcaption>
        </figure>

        <figure className="flex min-h-[19rem] flex-col justify-between border-t border-border py-9 sm:border-t-0 sm:px-8 lg:px-10">
          <button
            type="button"
            aria-label="Animate Gold Leaves"
            data-motion={animateLeavesArt ? "animated" : "instant"}
            onClick={animateLeaves}
            className={artButtonClass}
          >
            <span className="relative flex h-40 w-40 items-center justify-center [perspective:700px]">
              <motion.img
                key={`leaves-${leavesCycle}`}
                src={BRACK_GOLD_LEAVES_ICON_IMAGE}
                alt=""
                width={256}
                height={256}
                loading="lazy"
                decoding="async"
                initial={false}
                animate={
                  leavesCycle > 0 && animateLeavesArt
                    ? {
                        y: [0, -7, -4, -2, 0],
                        rotate: [0, -4, 4, -2, 0],
                        rotateY: [0, 14, 4, -7, 0],
                        scale: [1, 1.045, 1.03, 1.015, 1],
                      }
                    : { y: 0, rotate: 0, rotateY: 0, scale: 1 }
                }
                transition={{
                  duration: animateLeavesArt ? 0.68 : 0,
                  times: [0, 0.25, 0.5, 0.72, 1],
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="h-32 w-32 object-contain drop-shadow-[0_24px_20px_hsl(var(--foreground)/0.16)]"
                style={{ transformOrigin: "50% 86%", transformStyle: "preserve-3d" }}
              />
              {leavesCycle > 0 && animateLeavesArt ? (
                <span key={`leaf-glints-${leavesCycle}`} aria-hidden="true">
                  <motion.span
                    initial={{ opacity: 0, scale: 0, y: 4 }}
                    animate={{ opacity: [0, 0.9, 0], scale: [0, 1, 0.35], y: [4, -4, -10] }}
                    transition={{ duration: 0.55, delay: 0.08 }}
                    className="absolute right-5 top-5 h-1.5 w-1.5 rounded-full bg-primary"
                  />
                  <motion.span
                    initial={{ opacity: 0, scale: 0, y: 2 }}
                    animate={{ opacity: [0, 0.7, 0], scale: [0, 0.8, 0.2], y: [2, -3, -7] }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="absolute left-7 top-10 h-1 w-1 rounded-full bg-primary"
                  />
                </span>
              ) : null}
            </span>
          </button>
          <figcaption className="mt-5 border-t border-border pt-5">
            <p className="font-display text-xl font-semibold">Gold Leaves</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Rare, spendable currency for special rewards.
            </p>
            <p className="mt-3 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-foreground/60">
              Press to rustle the leaves
            </p>
          </figcaption>
        </figure>
      </div>
    </div>
  );
};
