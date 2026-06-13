import { useRef } from "react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { FireFlame } from "iconoir-react";
import { cn } from "@/lib/utils";

interface StreakFlameProps {
  active?: boolean;
  intensity?: number;
  className?: string;
}

/**
 * Animated flame for streak display
 */
export const StreakFlame = ({
  active = true,
  intensity = 1,
  className,
}: StreakFlameProps) => {
  const flameRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!flameRef.current || !active) return;

    // Flickering animation
    gsap.to(flameRef.current, {
      scale: 1 + intensity * 0.1,
      duration: 0.3,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
    });

    // Glow pulse
    gsap.to(flameRef.current, {
      filter: `drop-shadow(0 0 ${10 * intensity}px rgba(255, 69, 0, 0.6))`,
      duration: 0.5,
      repeat: -1,
      yoyo: true,
      ease: "power2.inOut",
    });
  }, { dependencies: [active, intensity] });

  return (
    <div
      ref={flameRef}
      className={cn("inline-flex items-center justify-center", className)}
    >
      <FireFlame className="h-full w-full text-orange-500" fill="currentColor" />
    </div>
  );
};
