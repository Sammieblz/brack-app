import { useEffect, useRef } from "react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrophyRevealProps {
  show?: boolean;
  size?: number;
  className?: string;
}

/**
 * Animated trophy reveal for goal completion
 */
export const TrophyReveal = ({
  show = true,
  size = 64,
  className,
}: TrophyRevealProps) => {
  const trophyRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!trophyRef.current || !glowRef.current || !show) return;

    const tl = gsap.timeline();

    // Initial scale and rotation
    tl.fromTo(
      trophyRef.current,
      { scale: 0, rotation: -180, opacity: 0 },
      {
        scale: 1.2,
        rotation: 0,
        opacity: 1,
        duration: 0.6,
        ease: "back.out(1.7)",
      }
    );

    // Bounce back
    tl.to(trophyRef.current, {
      scale: 1,
      duration: 0.3,
      ease: "power2.out",
    });

    // Glow pulse
    tl.to(glowRef.current, {
      scale: 1.5,
      opacity: 0.8,
      duration: 0.5,
      repeat: 2,
      yoyo: true,
      ease: "power2.inOut",
    }, "-=0.2");

    // Continuous subtle pulse
    gsap.to(trophyRef.current, {
      y: -5,
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
      delay: 1,
    });
  }, { dependencies: [show] });

  if (!show) return null;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <div
        ref={glowRef}
        className="absolute inset-0 bg-yellow-400/30 rounded-full blur-xl"
        style={{ width: size * 1.5, height: size * 1.5 }}
      />
      <div ref={trophyRef} className="relative z-10">
        <Trophy
          className="text-yellow-500 fill-yellow-500"
          style={{ width: size, height: size }}
        />
      </div>
    </div>
  );
};
