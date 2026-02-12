import { useEffect, useRef } from "react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

interface ShimmerEffectProps {
  className?: string;
  duration?: number;
}

/**
 * Shimmer effect for skeleton loaders
 */
export const ShimmerEffect = ({ className, duration = 1.5 }: ShimmerEffectProps) => {
  const shimmerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!shimmerRef.current) return;

    gsap.to(shimmerRef.current, {
      x: "100%",
      duration,
      repeat: -1,
      ease: "none",
    });
  }, { immediate: true });

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div
        ref={shimmerRef}
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
        }}
      />
    </div>
  );
};

/**
 * Shimmer wrapper for skeleton components
 */
export const withShimmer = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return (props: P) => {
    return (
      <div className="relative">
        <Component {...props} />
        <ShimmerEffect className="absolute inset-0 pointer-events-none" />
      </div>
    );
  };
};
