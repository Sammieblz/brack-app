import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useRef } from "react";

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
  const scrollRootRef = useRef<HTMLElement | null>(
    typeof document === "undefined" ? null : document.getElementById("root"),
  );

  return (
    <motion.div
      data-motion={reducedMotion ? "reduced" : "reveal"}
      initial={reducedMotion ? false : { opacity: 0, y: distance }}
      animate={reducedMotion ? { opacity: 1, y: 0 } : undefined}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{
        root: scrollRootRef,
        once: true,
        amount: 0.18,
      }}
      transition={{
        duration: reducedMotion ? 0 : 0.5,
        delay: reducedMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
};
