import type { ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface ContainerScrollProps {
  titleComponent: ReactNode;
  footerComponent?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}

/**
 * A Vite-native, responsive adaptation of the 21st.dev / Aceternity container
 * scroll pattern. The device remains in normal document flow so small screens
 * never inherit the demo's fixed 60–80rem spacer or clipped perspective card.
 */
export const ContainerScroll = ({ titleComponent, footerComponent, children, className, id }: ContainerScrollProps) => {
  const containerRef = useRef<HTMLElement>(null);
  // Brack's application shell owns vertical scrolling on #root rather than on
  // window. Supplying it explicitly keeps the reveal live in web, PWA, and
  // embedded native shells.
  const scrollRootRef = useRef<HTMLElement | null>(
    typeof document === "undefined" ? null : document.getElementById("root"),
  );
  const reducedMotion = useReducedMotion();
  const { isPhone, isTablet } = useBreakpoint();
  const { scrollYProgress } = useScroll({
    container: scrollRootRef,
    target: containerRef,
    offset: ["start end", "center center"],
  });

  const easedProgress = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 26,
    mass: 0.45,
  });
  const rotateX = useTransform(easedProgress, [0, 1], [isPhone ? 8 : isTablet ? 11 : 16, 0]);
  const scale = useTransform(easedProgress, [0, 1], [isPhone ? 0.93 : isTablet ? 0.91 : 0.88, 1]);
  const translateY = useTransform(easedProgress, [0, 1], [isPhone ? 30 : isTablet ? 46 : 64, 0]);
  const titleTranslateY = useTransform(
    easedProgress,
    [0, 0.55, 0.85, 1],
    isPhone ? [42, 0, -56, -72] : isTablet ? [68, 0, -80, -100] : [96, 0, -108, -132],
  );

  return (
    <section
      id={id}
      ref={containerRef}
      className={cn(
        "relative isolate mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32",
        className,
      )}
    >
      <motion.div
        style={reducedMotion ? undefined : { translateY: titleTranslateY }}
        className="relative z-0 mx-auto max-w-4xl text-center"
      >
        {titleComponent}
      </motion.div>

      <div
        className={cn("relative w-full", reducedMotion ? "mt-10 sm:mt-14" : "z-20 -mt-44 lg:-mt-56")}
        style={{ perspective: "1400px" }}
      >
        <motion.div
          style={
            reducedMotion
              ? undefined
              : {
                  rotateX,
                  scale,
                  translateY,
                  transformOrigin: "50% 100%",
                }
          }
          className="relative mx-auto w-[min(88vw,39rem)] transform-gpu"
        >
          <div className="relative rounded-[2rem] border border-white/45 bg-[linear-gradient(145deg,hsl(var(--foreground)/0.92),hsl(var(--foreground)/0.72))] p-[7px] shadow-[0_2px_0_hsl(var(--background)/0.45)_inset,0_18px_34px_-16px_hsl(var(--foreground)/0.42),0_52px_90px_-44px_hsl(var(--foreground)/0.58)] sm:rounded-[2.75rem] sm:p-[11px]">
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-[3px] z-20 h-1 w-1 -translate-x-1/2 rounded-full bg-white/35 shadow-[0_0_0_1px_hsl(var(--foreground)/0.3)] sm:top-[5px] sm:h-1.5 sm:w-1.5"
            />
            <div className="relative aspect-[613/842] overflow-hidden rounded-[1.55rem] bg-background sm:rounded-[2.1rem]">
              {children}
            </div>
            <span
              aria-hidden="true"
              className="absolute -right-[3px] top-[19%] h-[8%] w-[3px] rounded-r-full bg-foreground/65 sm:-right-[4px] sm:w-1"
            />
            <span
              aria-hidden="true"
              className="absolute -left-[3px] top-[16%] h-[5%] w-[3px] rounded-l-full bg-foreground/60 sm:-left-[4px] sm:w-1"
            />
          </div>
        </motion.div>
      </div>
      {footerComponent ? <div className="relative z-30 mt-9 w-full max-w-xl sm:mt-12">{footerComponent}</div> : null}
    </section>
  );
};
