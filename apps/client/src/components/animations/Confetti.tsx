import { useEffect, useRef } from "react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

interface ConfettiProps {
  trigger?: boolean;
  count?: number;
  colors?: string[];
  className?: string;
}

/**
 * Confetti animation for celebrations
 */
export const Confetti = ({
  trigger = true,
  count = 50,
  colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F"],
  className,
}: ConfettiProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current || !trigger) return;

    const particles: HTMLDivElement[] = [];

    // Create particles
    for (let i = 0; i < count; i++) {
      const particle = document.createElement("div");
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = Math.random() * 8 + 4;
      const startX = Math.random() * 100;
      const angle = Math.random() * 360;
      const velocity = Math.random() * 200 + 100;

      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.backgroundColor = color;
      particle.style.position = "absolute";
      particle.style.left = `${startX}%`;
      particle.style.top = "0";
      particle.style.borderRadius = Math.random() > 0.5 ? "50%" : "0";
      particle.style.opacity = "0";

      containerRef.current.appendChild(particle);
      particles.push(particle);

      // Animate particle
      gsap.to(particle, {
        opacity: 1,
        duration: 0.1,
        delay: Math.random() * 0.2,
      });

      gsap.to(particle, {
        y: window.innerHeight + 100,
        x: `+=${Math.cos((angle * Math.PI) / 180) * velocity}`,
        rotation: Math.random() * 720 - 360,
        duration: Math.random() * 2 + 1.5,
        ease: "power2.out",
        delay: Math.random() * 0.3,
      });

      gsap.to(particle, {
        opacity: 0,
        duration: 0.3,
        delay: Math.random() * 1.5 + 1,
      });
    }

    // Cleanup after animation
    const cleanup = setTimeout(() => {
      particles.forEach((p) => p.remove());
    }, 4000);

    return () => {
      clearTimeout(cleanup);
      particles.forEach((p) => p.remove());
    };
  }, { dependencies: [trigger, count, colors] });

  return (
    <div
      ref={containerRef}
      className={cn("fixed inset-0 pointer-events-none z-[9998]", className)}
    />
  );
};
