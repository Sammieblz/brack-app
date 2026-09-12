import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BRACK_MARK_IMAGE } from "@/config/brackAssets";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import { BRACK_LOADER_TIMING } from "./brackLoaderTokens";
import "./BrackLoader.css";

export type BrackLoaderVariant = "compact" | "inline" | "section" | "fullscreen";

type LoaderMotion = "full" | "paused" | "settled" | "reduced" | "calm";

interface BrackLoaderProps {
  active?: boolean;
  variant?: BrackLoaderVariant;
  size?: "sm" | "md" | "lg";
  label?: string;
  visibleLabel?: boolean;
  progress?: number;
  delayMs?: number;
  className?: string;
}

const hasReducedDataPreference = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean };
  }).connection;

  return Boolean(
    connection?.saveData
      || window.matchMedia?.("(prefers-reduced-data: reduce)").matches,
  );
};

const useDelayedVisibility = (active: boolean, delayMs: number) => {
  const [visible, setVisible] = useState(active && delayMs <= 0);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    if (delayMs <= 0) {
      setVisible(true);
      return;
    }

    setVisible(false);
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return visible;
};

const useLoaderMotion = (enabled: boolean) => {
  const reducedMotion = useReducedMotion();
  const reducedData = hasReducedDataPreference();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  const [intersecting, setIntersecting] = useState(true);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setSettled(false);
    if (!enabled || reducedMotion || reducedData) return;

    const timer = window.setTimeout(
      () => setSettled(true),
      BRACK_LOADER_TIMING.motionDurationMs,
    );
    return () => window.clearTimeout(timer);
  }, [enabled, reducedData, reducedMotion]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const handleVisibility = () => setDocumentVisible(document.visibilityState !== "hidden");
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!enabled || !stage || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      setIntersecting(entry.isIntersecting);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [enabled]);

  let motion: LoaderMotion = "full";
  if (reducedMotion) motion = "reduced";
  else if (reducedData) motion = "calm";
  else if (settled) motion = "settled";
  else if (!documentVisible || !intersecting) motion = "paused";

  return { motion, stageRef };
};

const normalizeProgress = (progress: number | undefined) => {
  if (progress === undefined || !Number.isFinite(progress)) return undefined;
  return Math.min(100, Math.max(0, progress));
};

/**
 * The shared Brack waiting indicator. Every placement uses the same book,
 * timing and accessibility contract; variants only change layout density.
 */
export const BrackLoader = ({
  active = true,
  variant = "inline",
  size = "md",
  label = "Loading...",
  visibleLabel = true,
  progress,
  delayMs = BRACK_LOADER_TIMING.appearanceDelayMs,
  className,
}: BrackLoaderProps) => {
  const visible = useDelayedVisibility(active, delayMs);
  const { motion, stageRef } = useLoaderMotion(visible);
  const normalizedProgress = normalizeProgress(progress);
  const announcement = label.trim() || "Loading...";
  const loaderStyle = {
    "--brack-loader-mark": `url(${BRACK_MARK_IMAGE})`,
    "--brack-loader-motion-duration": `${BRACK_LOADER_TIMING.motionDurationMs}ms`,
  } as CSSProperties;

  if (!active || (variant === "fullscreen" && !visible)) return null;

  if (!visible) {
    return (
      <div
        className={cn("brack-loader brack-loader--pending", className)}
        data-size={size}
        data-variant={variant}
        data-visible="false"
        aria-hidden="true"
      >
        <span className="brack-loader__stage" />
      </div>
    );
  }

  return (
    <div
      className={cn("brack-loader", className)}
      style={loaderStyle}
      data-size={size}
      data-variant={variant}
      data-visible="true"
      data-motion={motion}
      data-motion-limit-ms={BRACK_LOADER_TIMING.motionDurationMs}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div ref={stageRef} className="brack-loader__stage" aria-hidden="true">
        <span className="brack-loader__shadow" />
        <span className="brack-loader__book">
          <span className="brack-loader__cover brack-loader__cover--back" />
          <span className="brack-loader__page-block brack-loader__page-block--right" />
          <span className="brack-loader__page brack-loader__page--left" />
          <span className="brack-loader__page brack-loader__page--right">
            <span className="brack-loader__page-mark" />
          </span>
          <span className="brack-loader__turning-page">
            <span className="brack-loader__page-lines" />
          </span>
          <span className="brack-loader__cover brack-loader__cover--front">
            <span className="brack-loader__cover-inlay" />
            <span className="brack-loader__mark-art" />
          </span>
          <span className="brack-loader__spine" />
        </span>
      </div>

      {visibleLabel ? (
        <span className="brack-loader__message">{announcement}</span>
      ) : (
        <span className="sr-only">{announcement}</span>
      )}

      {normalizedProgress !== undefined && (
        <span
          className="brack-loader__progress"
          role="progressbar"
          aria-label="Loading progress"
          aria-live="off"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={normalizedProgress}
        >
          <span
            className="brack-loader__progress-fill"
            style={{ transform: `scaleX(${normalizedProgress / 100})` }}
          />
        </span>
      )}
    </div>
  );
};

interface LogoSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
  delayMs?: number;
}

/** @deprecated Prefer BrackLoader for new loading surfaces. */
export const LogoSpinner = ({ size = "md", text, className, delayMs }: LogoSpinnerProps) => (
  <BrackLoader
    size={size}
    label={text?.trim() || "Loading..."}
    visibleLabel={Boolean(text?.trim())}
    className={className}
    delayMs={delayMs}
  />
);
