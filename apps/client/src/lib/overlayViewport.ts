import type { UIEnvironment } from "@/services/uiEnvironment";

export interface OverlayViewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

type ViewportEnvironment = Pick<UIEnvironment,
  "layoutWidth" | "layoutHeight" | "visualWidth" | "visualHeight"
  | "visualOffsetLeft" | "visualOffsetTop" | "visualScale" | "supportsVisualViewport"
>;

const positiveDimension = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const boundedOffset = (value: number, maximum: number) =>
  Number.isFinite(value) ? Math.min(maximum, Math.max(0, value)) : 0;

/**
 * Available CSS-pixel bounds for overlay layout, not keyboard detection.
 * Safe areas and surface margins belong to CSS. Pinch zoom keeps the layout
 * rectangle so browser magnification/panning is never counter-scaled or chased.
 */
export function deriveOverlayViewport(environment: ViewportEnvironment): OverlayViewport {
  const layoutWidth = positiveDimension(environment.layoutWidth, 0);
  const layoutHeight = positiveDimension(environment.layoutHeight, 0);
  if (!environment.supportsVisualViewport || environment.visualScale !== 1) {
    return { left: 0, top: 0, width: layoutWidth, height: layoutHeight };
  }

  // A zero-sized visual viewport can occur during lifecycle transitions.
  // Keep the usable layout fallback instead of collapsing an already-open form.
  const width = Math.min(layoutWidth, positiveDimension(environment.visualWidth, layoutWidth));
  const height = Math.min(layoutHeight, positiveDimension(environment.visualHeight, layoutHeight));
  return {
    left: boundedOffset(environment.visualOffsetLeft, layoutWidth - width),
    top: boundedOffset(environment.visualOffsetTop, layoutHeight - height),
    width,
    height,
  };
}

/** Shared surface preference; runtime identity never follows viewport geometry. */
export function prefersSheetPresentation(environment: Pick<UIEnvironment, "windowClass" | "anyCoarsePointer">): boolean {
  return environment.windowClass === "compact"
    || (environment.windowClass === "medium" && environment.anyCoarsePointer);
}
