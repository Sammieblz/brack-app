import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@/hooks/useGSAP";
import { gsap } from "gsap";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeartLikeProps {
  liked?: boolean;
  onLike?: () => void;
  size?: number;
  className?: string;
}

/**
 * Animated heart like button
 */
export const HeartLike = ({
  liked = false,
  onLike,
  size = 24,
  className,
}: HeartLikeProps) => {
  const heartRef = useRef<HTMLButtonElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useGSAP(() => {
    if (!heartRef.current || !isAnimating) return;

    const tl = gsap.timeline();

    // Scale up
    tl.to(heartRef.current, {
      scale: 1.3,
      duration: 0.15,
      ease: "power2.out",
    });

    // Scale down with bounce
    tl.to(heartRef.current, {
      scale: 1,
      duration: 0.3,
      ease: "back.out(2)",
    });

    tl.call(() => setIsAnimating(false));
  }, { dependencies: [isAnimating] });

  const handleClick = () => {
    setIsAnimating(true);
    onLike?.();
  };

  return (
    <button
      ref={heartRef}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded",
        className
      )}
      aria-label={liked ? "Unlike" : "Like"}
    >
      <Heart
        className={cn(
          "transition-colors",
          liked ? "fill-red-500 text-red-500" : "text-muted-foreground"
        )}
        style={{ width: size, height: size }}
      />
    </button>
  );
};
