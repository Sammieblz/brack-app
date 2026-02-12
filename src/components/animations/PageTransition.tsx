import { useEffect, useRef, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Page transition wrapper for route changes
 */
export const PageTransition = ({ children, className }: PageTransitionProps) => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLocationRef = useRef(location.pathname);

  useGSAP(() => {
    if (!containerRef.current) return;

    // Only animate if pathname changed
    if (prevLocationRef.current !== location.pathname) {
      const tl = gsap.timeline();

      // Fade out old content
      tl.to(containerRef.current, {
        opacity: 0,
        y: -10,
        duration: 0.15,
        ease: "power2.in",
      });

      // Fade in new content
      tl.to(containerRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.25,
        ease: "power2.out",
      });
    }

    prevLocationRef.current = location.pathname;
  }, { dependencies: [location.pathname] });

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      {children}
    </div>
  );
};
