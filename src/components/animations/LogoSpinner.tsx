import { useEffect, useRef } from "react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { ThemeAwareLogo } from "@/components/ThemeAwareLogo";

interface LogoSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export const LogoSpinner = ({ size = "md", text, className }: LogoSpinnerProps) => {
  const logoRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  useGSAP(() => {
    if (!logoRef.current) return;

    // Continuous rotation
    gsap.to(logoRef.current, {
      rotation: 360,
      duration: 2,
      repeat: -1,
      ease: "none",
    });

    // Subtle pulse
    gsap.to(logoRef.current, {
      scale: 1.1,
      duration: 1,
      repeat: -1,
      yoyo: true,
      ease: "power2.inOut",
    });
  }, { dependencies: [] });

  return (
    <div ref={containerRef} className={cn("flex flex-col items-center space-y-4", className)}>
      <div ref={logoRef} className={cn("relative", sizeClasses[size])}>
        <ThemeAwareLogo
          variant="icon"
          size={sizeClasses[size]}
          className="h-full w-full"
        />
        {/* Glow effect - uses primary color from theme */}
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg -z-10" />
      </div>
      {text && (
        <span className={cn(textSizes[size], "font-sans font-medium text-muted-foreground")}>
          {text}
        </span>
      )}
    </div>
  );
};
