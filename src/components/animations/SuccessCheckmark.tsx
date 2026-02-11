import { useEffect, useRef } from "react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuccessCheckmarkProps {
  show?: boolean;
  size?: number;
  className?: string;
}

/**
 * Animated success checkmark
 */
export const SuccessCheckmark = ({
  show = true,
  size = 48,
  className,
}: SuccessCheckmarkProps) => {
  const checkRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!checkRef.current || !circleRef.current || !show) return;

    const tl = gsap.timeline();

    // Scale in circle
    tl.fromTo(
      circleRef.current,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.3,
        ease: "back.out(1.7)",
      }
    );

    // Draw checkmark
    tl.fromTo(
      checkRef.current,
      { scale: 0, opacity: 0, rotation: -45 },
      {
        scale: 1,
        opacity: 1,
        rotation: 0,
        duration: 0.4,
        ease: "back.out(1.7)",
      },
      "-=0.1"
    );

    // Pulse effect
    tl.to(circleRef.current, {
      scale: 1.1,
      duration: 0.2,
      yoyo: true,
      repeat: 1,
      ease: "power2.inOut",
    });
  }, { dependencies: [show] });

  if (!show) return null;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <div
        ref={circleRef}
        className="absolute rounded-full bg-green-500"
        style={{ width: size, height: size }}
      />
      <div ref={checkRef} className="relative z-10">
        <Check
          className="text-white"
          style={{ width: size * 0.6, height: size * 0.6 }}
        />
      </div>
    </div>
  );
};
