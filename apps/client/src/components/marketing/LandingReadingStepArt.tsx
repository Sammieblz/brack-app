import { motion } from "framer-motion";
import { useRef } from "react";

import { useReducedMotion } from "@/hooks/useReducedMotion";

import "./landing-editorial.css";

export type ReadingStep = "resume" | "record" | "understand";

const artwork = {
  resume: {
    source: "/3dicons/3dicons-notebook-front-clay.webp",
    tilt: -5,
    motion: { rotate: [-5, 0], x: 0, y: 0 },
    duration: 0.6,
  },
  record: {
    source: "/3dicons/3dicons-pencil-front-clay.webp",
    tilt: 0,
    motion: { rotate: [0, -3, 0], x: [0, 3, 0], y: [0, 2, 0] },
    duration: 0.65,
  },
  understand: {
    source: "/3dicons/3dicons-chart-front-clay.webp",
    tilt: 5,
    motion: { rotate: [5, 0], x: 0, y: 0 },
    duration: 0.6,
  },
};

/** Small editorial objects, not controls. Each gestures once, then stays still. */
export const LandingReadingStepArt = ({ step }: { step: ReadingStep }) => {
  const reducedMotion = useReducedMotion();
  const root = useRef<HTMLElement | null>(
    typeof document === "undefined" ? null : document.getElementById("root"),
  );
  const art = artwork[step];

  return (
    <span className="landing-reading-step-art" aria-hidden="true" data-step={step}>
      <motion.img
        src={art.source}
        alt=""
        width={500}
        height={500}
        loading="lazy"
        decoding="async"
        draggable={false}
        initial={reducedMotion ? false : { rotate: art.tilt, x: 0, y: 0 }}
        animate={reducedMotion ? { rotate: 0, x: 0, y: 0 } : undefined}
        whileInView={reducedMotion ? undefined : art.motion}
        viewport={{ root, once: true, amount: 0.6 }}
        transition={{ duration: reducedMotion ? 0 : art.duration, ease: [0.22, 1, 0.36, 1] }}
      />
    </span>
  );
};
