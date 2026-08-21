import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";
import "./progress.css";

type ProgressVariant = "default" | "dimensional";

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Adds a beveled, animated treatment for prominent task progress. */
  variant?: ProgressVariant;
  /** Draws meaningful divisions in the rail, such as onboarding steps. */
  segments?: number;
}

type ProgressStyle = React.CSSProperties & {
  "--brack-progress-segments"?: number;
};

const DEFAULT_MAX = 100;
const MAX_RENDERED_SEGMENTS = 24;

type SegmentState = "complete" | "current" | "upcoming" | "unknown";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({
  className,
  value,
  max,
  variant = "default",
  segments,
  style,
  "aria-label": ariaLabel,
  ...props
}, ref) => {
  const safeMax = typeof max === "number" && Number.isFinite(max) && max > 0
    ? max
    : DEFAULT_MAX;
  const isDeterminate = typeof value === "number" && Number.isFinite(value);
  const safeValue = isDeterminate
    ? Math.min(Math.max(value, 0), safeMax)
    : null;
  const percentage = safeValue === null ? null : (safeValue / safeMax) * 100;
  const segmentCount = typeof segments === "number" && Number.isFinite(segments) && segments > 1
    ? Math.min(Math.floor(segments), MAX_RENDERED_SEGMENTS)
    : undefined;
  const rootStyle: ProgressStyle = segmentCount
    ? { ...style, "--brack-progress-segments": segmentCount }
    : style ?? {};
  const valueKey = safeValue === null ? "indeterminate" : String(safeValue);
  const activeSegmentIndex = safeValue !== null && safeValue > 0 && safeValue < safeMax && segmentCount
    ? Math.min(
        segmentCount - 1,
        Math.ceil(((safeValue / safeMax) * segmentCount) - 1e-9) - 1,
      )
    : null;

  const getSegmentState = (index: number): SegmentState => {
    if (percentage === null) return "unknown";
    if (percentage >= 100) return "complete";
    if (activeSegmentIndex === index) return "current";
    if (activeSegmentIndex !== null && index < activeSegmentIndex) return "complete";
    return "upcoming";
  };

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={safeValue}
      max={safeMax}
      aria-label={ariaLabel ?? (isDeterminate ? "Progress" : "Loading")}
      data-slot="progress"
      data-variant={variant}
      data-segments={segmentCount}
      data-empty={percentage === 0 ? "true" : undefined}
      className={cn(
        "brack-progress relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        variant === "dimensional" && "brack-progress--dimensional",
        className,
      )}
      style={rootStyle}
      {...props}
    >
      <div aria-hidden="true" className="brack-progress__track">
        <div className="brack-progress__viewport">
          <ProgressPrimitive.Indicator
            data-slot="progress-indicator"
            className={cn(
              "brack-progress__indicator h-full bg-primary",
              variant === "default" && "brack-progress__indicator--default w-full flex-1",
              percentage === null && "brack-progress__indicator--indeterminate",
              variant === "dimensional" && "brack-progress__indicator--dimensional",
            )}
            style={percentage === null
              ? { width: "38%" }
              : variant === "dimensional"
                ? { width: `${percentage}%` }
                : { width: "100%", transform: `translateX(-${100 - percentage}%)` }}
          >
            <span className="brack-progress__texture" />
            <span key={`specular-${valueKey}`} className="brack-progress__specular" />
            {variant === "default" && (
              <span key={`cap-${valueKey}`} className="brack-progress__cap" />
            )}
          </ProgressPrimitive.Indicator>
        </div>

        {variant === "dimensional" && segmentCount && (
          <span className="brack-progress__segments">
            {Array.from({ length: segmentCount }, (_, index) => {
              const stepPosition = ((index + 1) / segmentCount) * 100;
              const segmentState = getSegmentState(index);

              return (
                <span
                  key={index}
                  className="brack-progress__segment"
                  data-segment-state={segmentState}
                  data-last={index === segmentCount - 1 ? "true" : undefined}
                  style={{
                    left: `clamp(calc(var(--brack-progress-node-size) / 2), ${stepPosition}%, calc(100% - var(--brack-progress-node-size) / 2))`,
                  }}
                >
                  <span className="brack-progress__segment-number">{index + 1}</span>
                  <span className="brack-progress__segment-check" />
                </span>
              );
            })}
          </span>
        )}

        {variant === "dimensional" && (
          <span
            className={cn(
              "brack-progress__marker-position",
              percentage === null && "brack-progress__marker-position--indeterminate",
            )}
            data-empty={percentage === 0 ? "true" : undefined}
            data-complete={percentage === 100 ? "true" : undefined}
            style={percentage === null
              ? undefined
              : { left: `clamp(var(--brack-progress-marker-width), ${percentage}%, 100%)` }}
          >
            <span key={`marker-${valueKey}`} className="brack-progress__marker">
              <span className="brack-progress__page brack-progress__page--back" />
              <span className="brack-progress__page brack-progress__page--front" />
              <span className="brack-progress__bookmark" />
            </span>
          </span>
        )}
      </div>
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
export type { ProgressProps, ProgressVariant };
