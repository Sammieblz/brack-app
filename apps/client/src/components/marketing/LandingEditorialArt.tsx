import { useInView } from "framer-motion";
import { useRef, type CSSProperties } from "react";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

import "./landing-editorial.css";

const useEditorialEntrance = () => {
  const ref = useRef<HTMLSpanElement>(null);
  const root = useRef<HTMLElement | null>(typeof document === "undefined" ? null : document.getElementById("root"));
  const reducedMotion = useReducedMotion();
  const inView = useInView(ref, { root, once: true, amount: 0.25 });
  return { ref, ready: inView || reducedMotion, reducedMotion };
};

/** The complete sentence is available immediately to assistive technology. */
export const LandingSentenceReveal = ({ text }: { text: string }) => {
  const { ref, ready, reducedMotion } = useEditorialEntrance();
  const words = text.split(" ");

  return (
    <span ref={ref} className="landing-sentence" data-ready={ready} data-reduced-motion={reducedMotion}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <span key={`${index}-${word}`} className="landing-sentence__word-wrap">
            <span
              className="landing-sentence__word"
              style={{ "--word-delay": `${Math.min(index * 24, 264)}ms` } as CSSProperties}
            >
              {word}
            </span>
            {index < words.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    </span>
  );
};

export const LandingIllustration = ({ kind, className }: { kind: "book" | "circle"; className?: string }) => {
  const { ref, ready, reducedMotion } = useEditorialEntrance();

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn("landing-illustration", `landing-illustration--${kind}`, className)}
      data-ready={ready}
      data-reduced-motion={reducedMotion}
    >
      <img
        src={`/landing-page/reading-${kind}-sculpture.webp`}
        alt=""
        width={640}
        height={640}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </span>
  );
};
