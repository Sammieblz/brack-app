import { useMemo } from "react";
import { deriveOverlayViewport } from "@/lib/overlayViewport";
import { useUIEnvironment } from "./useUIEnvironment";

/** Reuse the shared environment subscription; overlay geometry owns no listeners. */
export function useOverlayViewport() {
  const {
    layoutWidth, layoutHeight, visualWidth, visualHeight, visualOffsetLeft,
    visualOffsetTop, visualScale, supportsVisualViewport,
  } = useUIEnvironment();

  return useMemo(() => deriveOverlayViewport({
    layoutWidth, layoutHeight, visualWidth, visualHeight, visualOffsetLeft,
    visualOffsetTop, visualScale, supportsVisualViewport,
  }), [layoutWidth, layoutHeight, visualWidth, visualHeight, visualOffsetLeft,
    visualOffsetTop, visualScale, supportsVisualViewport]);
}
