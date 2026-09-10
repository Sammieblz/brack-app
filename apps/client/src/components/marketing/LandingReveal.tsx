import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useRef, useState } from "react";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface LandingRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
}

/**
 * A quiet, once-only entrance for the landing page's editorial groups.
 * Brack scrolls inside #root, so the observer must use that element rather
 * than the browser viewport. Reduced-motion visitors receive static content.
 */
export const LandingReveal = ({ children, className, delay = 0, distance = 16 }: LandingRevealProps) => {
  const reducedMotion = useReducedMotion();
  const [hasFocused, setHasFocused] = useState(false);
  const showImmediately = reducedMotion || hasFocused;
  const scrollRootRef = useRef<HTMLElement | null>(
    typeof document === "undefined" ? null : document.getElementById("root"),
  );

  return (
    <motion.div
      data-motion={reducedMotion ? "reduced" : "reveal"}
      initial={showImmediately ? false : { opacity: 0, y: distance }}
      animate={showImmediately ? { opacity: 1, y: 0 } : undefined}
      whileInView={showImmediately ? undefined : { opacity: 1, y: 0 }}
      onFocusCapture={() => setHasFocused(true)}
      viewport={{
        root: scrollRootRef,
        once: true,
        amount: 0.18,
      }}
      transition={{
        duration: showImmediately ? 0 : 0.5,
        delay: showImmediately ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn("landing-reveal", className)}
    >
      {children}
    </motion.div>
  );
};
