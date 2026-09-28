import { describe, expect, it } from "vitest";
import { deriveOverlayViewport, prefersSheetPresentation } from "./overlayViewport";

const environment = {
  layoutWidth: 800, layoutHeight: 900,
  visualWidth: 800, visualHeight: 900,
  visualOffsetLeft: 0, visualOffsetTop: 0,
  visualScale: 1, supportsVisualViewport: true,
};

describe("overlay viewport bounds", () => {
  it("uses unscaled visual height and offsets without guessing the cause of occlusion", () => {
    expect(deriveOverlayViewport({ ...environment, visualWidth: 760, visualHeight: 320, visualOffsetLeft: 15, visualOffsetTop: 20 }))
      .toEqual({ left: 15, top: 20, width: 760, height: 320 });
    expect(environment.layoutHeight).toBe(900);
  });

  it("falls back to the layout rectangle when VisualViewport is unavailable", () => {
    expect(deriveOverlayViewport({ ...environment, supportsVisualViewport: false, visualHeight: 320, visualOffsetTop: 20 }))
      .toEqual({ left: 0, top: 0, width: 800, height: 900 });
  });

  it.each([0.5, 2, 0, Number.NaN, Number.POSITIVE_INFINITY])("leaves zoom/pan with the browser at scale %s", visualScale => {
    expect(deriveOverlayViewport({ ...environment, visualScale, visualWidth: 400, visualHeight: 450, visualOffsetLeft: 70, visualOffsetTop: 120 }))
      .toEqual({ left: 0, top: 0, width: 800, height: 900 });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("uses layout fallback for invalid visual dimensions %s", dimension => {
    expect(deriveOverlayViewport({ ...environment, visualWidth: dimension, visualHeight: dimension, visualOffsetLeft: 15, visualOffsetTop: 20 }))
      .toEqual({ left: 0, top: 0, width: 800, height: 900 });
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("never produces negative/nonfinite geometry from invalid layout dimensions %s", dimension => {
    expect(deriveOverlayViewport({ ...environment, layoutWidth: dimension, layoutHeight: dimension }))
      .toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });

  it("keeps server/initial zero geometry finite without manufacturing a device size", () => {
    expect(deriveOverlayViewport({ ...environment, layoutWidth: 0, layoutHeight: 0, visualWidth: 0, visualHeight: 0 }))
      .toEqual({ left: 0, top: 0, width: 0, height: 0 });
  });

  it("bounds transient oversized visual geometry and offsets within the layout rectangle", () => {
    expect(deriveOverlayViewport({ ...environment, visualWidth: 1200, visualHeight: 1200, visualOffsetLeft: 50, visualOffsetTop: 50 }))
      .toEqual({ left: 0, top: 0, width: 800, height: 900 });
    expect(deriveOverlayViewport({ ...environment, visualWidth: 700, visualHeight: 500, visualOffsetLeft: 1000, visualOffsetTop: 1000 }))
      .toEqual({ left: 100, top: 400, width: 700, height: 500 });
    expect(deriveOverlayViewport({ ...environment, visualWidth: 700, visualHeight: 500, visualOffsetLeft: -10, visualOffsetTop: Number.NaN }))
      .toEqual({ left: 0, top: 0, width: 700, height: 500 });
  });

  it("preserves fractional CSS pixels rather than repeatedly rounding geometry", () => {
    expect(deriveOverlayViewport({ ...environment, visualWidth: 799.5, visualHeight: 500.25, visualOffsetLeft: 0.25, visualOffsetTop: 10.75 }))
      .toEqual({ left: 0.25, top: 10.75, width: 799.5, height: 500.25 });
  });
});

describe("shared overlay presentation preference", () => {
  it.each([
    ["compact", false, true], ["compact", true, true],
    ["medium", false, false], ["medium", true, true],
    ["expanded", false, false], ["expanded", true, false],
  ] as const)("uses %s width with coarse=%s to select sheet=%s", (windowClass, anyCoarsePointer, expected) => {
    expect(prefersSheetPresentation({ windowClass, anyCoarsePointer })).toBe(expected);
  });
});
