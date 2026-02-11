import { useEffect, useRef } from "react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

interface ProgressBarFillProps {
  progress: number; // 0-100
  duration?: number;
  className?: string;
  showGlow?: boolean;
}

/**
 * Animated progress bar fill
 */
export const ProgressBarFill = ({
  progress,
  duration = 1,
  className,
  showGlow = true,
}: ProgressBarFillProps) => {
  const fillRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!fillRef.current) return;

    gsap.to(fillRef.current, {
      width: `${progress}%`,
      duration,
      ease: "power2.out",
    });

    if (showGlow && glowRef.current) {
      gsap.to(glowRef.current, {
        opacity: progress >= 100 ? 0.6 : 0.3,
        duration,
        ease: "power2.out",
      });
    }
  }, { dependencies: [progress, duration, showGlow] });

  return (
    <div className={cn("relative h-full overflow-hidden rounded-full", className)}>
      <div
        ref={fillRef}
        className="h-full bg-gradient-primary transition-all"
        style={{ width: "0%" }}
      />
      {showGlow && (
        <div
          ref={glowRef}
          className="absolute inset-0 bg-primary/30 blur-sm"
          style={{ opacity: 0 }}
        />
      )}
    </div>
  );
};
