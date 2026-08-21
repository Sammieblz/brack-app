import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { BRACK_MARK_IMAGE } from "@/config/brackAssets";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import "./BrackLoader.css";

const BRACK_LOADER_MOTION = {
  iterations: 2,
  markDurationMs: 2_100,
  orbitDurationMs: 2_400,
  shadowDurationMs: 2_100,
} as const;

const BRACK_LOADER_MAX_MOTION_MS = Math.max(
  BRACK_LOADER_MOTION.markDurationMs,
  BRACK_LOADER_MOTION.orbitDurationMs,
  BRACK_LOADER_MOTION.shadowDurationMs,
) * BRACK_LOADER_MOTION.iterations;

interface LogoSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export const LogoSpinner = ({ size = "md", text, className }: LogoSpinnerProps) => {
  const reducedMotion = useReducedMotion();
  const announcement = text?.trim() || "Loading...";
  const loaderStyle = {
    "--brack-loader-mark": `url(${BRACK_MARK_IMAGE})`,
    "--brack-loader-mark-duration": `${BRACK_LOADER_MOTION.markDurationMs}ms`,
    "--brack-loader-orbit-duration": `${BRACK_LOADER_MOTION.orbitDurationMs}ms`,
    "--brack-loader-shadow-duration": `${BRACK_LOADER_MOTION.shadowDurationMs}ms`,
    "--brack-loader-motion-iterations": BRACK_LOADER_MOTION.iterations,
  } as CSSProperties;

  return (
    <div
      className={cn("brack-loader", className)}
      style={loaderStyle}
      data-size={size}
      data-motion={reducedMotion ? "reduced" : "full"}
      data-motion-limit-ms={BRACK_LOADER_MAX_MOTION_MS}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="brack-loader__stage" aria-hidden="true">
        <span className="brack-loader__shadow" />
        <span className="brack-loader__page brack-loader__page--left" />
        <span className="brack-loader__page brack-loader__page--right" />
        <span className="brack-loader__orbit" />
        <span className="brack-loader__mark">
          <span className="brack-loader__mark-art" />
        </span>
      </div>

      {text?.trim() ? (
        <span className="brack-loader__message">
          {text}
        </span>
      ) : (
        <span className="sr-only">{announcement}</span>
      )}
    </div>
  );
};
