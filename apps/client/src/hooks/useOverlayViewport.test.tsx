import { act, cleanup, renderHook } from "@testing-library/react";
import { Capacitor } from "@capacitor/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUIEnvironmentSnapshot } from "@/services/uiEnvironment";
import { useAppViewportHeight } from "./useAppViewportHeight";
import { useOverlayViewport } from "./useOverlayViewport";

const viewport = () => Object.assign(new EventTarget(), {
  width: 800, height: 900, offsetLeft: 0, offsetTop: 0, scale: 1,
});

beforeEach(() => {
  vi.stubGlobal("innerWidth", 800);
  vi.stubGlobal("innerHeight", 900);
  vi.stubGlobal("visualViewport", undefined);
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty("--app-viewport-height");
});

describe("shared overlay viewport observation", () => {
  it("updates overlay bounds without resizing the page or changing the layout class", () => {
    const visual = viewport();
    vi.stubGlobal("visualViewport", visual);
    const { result } = renderHook(() => { useAppViewportHeight(); return useOverlayViewport(); });
    act(() => {
      Object.assign(visual, { height: 320, offsetTop: 20 });
      visual.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ left: 0, top: 20, width: 800, height: 320 });
    expect(document.documentElement.style.getPropertyValue("--app-viewport-height")).toBe("900px");
    expect(getUIEnvironmentSnapshot()).toMatchObject({ runtime: "web", windowClass: "medium", layoutHeight: 900 });
    act(() => { visual.offsetTop = 40; visual.dispatchEvent(new Event("scroll")); });
    expect(result.current.top).toBe(40);
  });

  it("keeps one shared set of geometry listeners for multiple overlay consumers", () => {
    const visual = viewport();
    vi.stubGlobal("visualViewport", visual);
    const windowAdd = vi.spyOn(window, "addEventListener");
    const windowRemove = vi.spyOn(window, "removeEventListener");
    const visualAdd = vi.spyOn(visual, "addEventListener");
    const visualRemove = vi.spyOn(visual, "removeEventListener");
    const first = renderHook(useOverlayViewport);
    const second = renderHook(useOverlayViewport);
    expect(windowAdd.mock.calls.filter(([event]) => event === "resize")).toHaveLength(1);
    expect(visualAdd.mock.calls.filter(([event]) => event === "resize")).toHaveLength(1);
    expect(visualAdd.mock.calls.filter(([event]) => event === "scroll")).toHaveLength(1);
    first.unmount();
    expect(visualRemove).not.toHaveBeenCalled();
    second.unmount();
    expect(windowRemove.mock.calls.filter(([event]) => event === "resize")).toHaveLength(1);
    expect(visualRemove.mock.calls.filter(([event]) => event === "resize")).toHaveLength(1);
    expect(visualRemove.mock.calls.filter(([event]) => event === "scroll")).toHaveLength(1);
  });

  it("uses the current layout rectangle during pinch zoom and resumes visual bounds afterward", () => {
    const visual = viewport();
    vi.stubGlobal("visualViewport", visual);
    const { result } = renderHook(useOverlayViewport);
    act(() => {
      Object.assign(visual, { scale: 2, width: 400, height: 450, offsetLeft: 80, offsetTop: 60 });
      visual.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ left: 0, top: 0, width: 800, height: 900 });
    expect(getUIEnvironmentSnapshot().windowClass).toBe("medium");
    act(() => {
      vi.stubGlobal("innerWidth", 1100);
      vi.stubGlobal("innerHeight", 700);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ left: 0, top: 0, width: 1100, height: 700 });
    act(() => {
      Object.assign(visual, { scale: 1, width: 1100, height: 300, offsetLeft: 0, offsetTop: 25 });
      visual.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ left: 0, top: 25, width: 1100, height: 300 });
  });

  it("continues to follow window resize without VisualViewport", () => {
    const { result } = renderHook(useOverlayViewport);
    expect(result.current).toEqual({ left: 0, top: 0, width: 800, height: 900 });
    act(() => {
      vi.stubGlobal("innerWidth", 390);
      vi.stubGlobal("innerHeight", 650);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ left: 0, top: 0, width: 390, height: 650 });
  });
});
