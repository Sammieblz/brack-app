import { useEffect, useRef } from "react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface ConfettiProps {
  trigger?: boolean;
  count?: number;
  colors?: string[];
  className?: string;
}

const DEFAULT_CONFETTI_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary-glow))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(var(--foreground))",
  "hsl(var(--muted-foreground))",
];

/**
 * Confetti animation for celebrations
 */
export const Confetti = ({
  trigger = true,
  count = 50,
  colors = DEFAULT_CONFETTI_COLORS,
  className,
}: ConfettiProps) => {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef(new Set<HTMLDivElement>());
  const cleanupTimersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const cleanupTimers = cleanupTimersRef.current;
    const particles = particlesRef.current;

    return () => {
      cleanupTimers.forEach((timer) => clearTimeout(timer));
      cleanupTimers.clear();
      particles.forEach((particle) => particle.remove());
      particles.clear();
    };
  }, []);

  useGSAP(() => {
    if (!containerRef.current || !trigger || reducedMotion) return;

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
      particlesRef.current.add(particle);

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
      particles.forEach((particle) => {
        particle.remove();
        particlesRef.current.delete(particle);
      });
      cleanupTimersRef.current.delete(cleanup);
    }, 4000);
    cleanupTimersRef.current.add(cleanup);
  }, { dependencies: [trigger, count, colors, reducedMotion] });

  if (reducedMotion) return null;

  return (
    <div
      ref={containerRef}
      className={cn("fixed inset-0 pointer-events-none z-[9998]", className)}
    />
  );
};
