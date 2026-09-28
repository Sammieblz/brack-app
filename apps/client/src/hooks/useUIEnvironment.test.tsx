import { act, cleanup, renderHook } from "@testing-library/react";
import { Capacitor } from "@capacitor/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIEnvironment } from "./useUIEnvironment";
import { usePlatform } from "./usePlatform";
import { useBreakpoint } from "./useBreakpoint";
import { useAppViewportHeight } from "./useAppViewportHeight";
import { detectPlatform } from "@/lib/platform";
import { getAuthFlowSurface, getAuthRedirectUrl } from "@/services/platform";
import { getUIEnvironmentSnapshot, getServerUIEnvironmentSnapshot } from "@/services/uiEnvironment";

class Media extends EventTarget {
  matches = false;
  addListener = (callback: EventListener) => this.addEventListener("change", callback);
  removeListener = (callback: EventListener) => this.removeEventListener("change", callback);
  set(matches: boolean) { this.matches = matches; this.dispatchEvent(new Event("change")); }
}
let media: Map<string, Media>;
const query = (name: string) => {
  if (!media.has(name)) media.set(name, new Media());
  return media.get(name)!;
};
const resize = (width: number, height = 900) => {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", height);
  window.dispatchEvent(new Event("resize"));
};

beforeEach(() => {
  media = new Map();
  vi.stubGlobal("matchMedia", (name: string) => query(name));
  vi.stubGlobal("visualViewport", undefined);
  resize(390, 844);
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  delete window.brackDesktop;
  delete (navigator as Navigator & { standalone?: boolean }).standalone;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty("--app-viewport-height");
});

describe("UI environment", () => {
  it.each(["ios", "android"] as const)("reports native %s on the first render without a web frame", (runtime) => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue(runtime);
    const renders: string[] = [];
    const { result } = renderHook(() => {
      const environment = useUIEnvironment();
      renders.push(environment.runtime);
      return { environment, legacy: usePlatform() };
    });
    expect(renders.every((value) => value === runtime)).toBe(true);
    expect(result.current.environment.displayMode).toBe("app");
    expect(result.current.legacy.platform).toBe(runtime);
    expect(result.current.legacy.isMobile).toBe(true);
    expect(detectPlatform()).toBe(runtime);
  });

  it.each(["iPhone", "Android", "Macintosh; Intel Mac OS X 10_15; iPad"])("does not turn %s browser UA into native", (userAgent) => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
    const { result } = renderHook(() => ({ environment: useUIEnvironment(), legacy: usePlatform() }));
    expect(result.current.environment.runtime).toBe("web");
    expect(result.current.environment.displayMode).toBe("browser");
    expect(result.current.legacy.isMobile).toBe(false);
    expect(detectPlatform()).toBe("web");
  });

  it("keeps a small Electron window desktop while using legacy web styling", () => {
    window.brackDesktop = {} as NonNullable<Window["brackDesktop"]>;
    const { result } = renderHook(() => ({ environment: useUIEnvironment(), legacy: usePlatform() }));
    expect(result.current.environment).toMatchObject({ runtime: "desktop", displayMode: "app", windowClass: "compact" });
    expect(result.current.legacy.platform).toBe("web");
  });

  it("reacts to standalone changes while auth remains a same-origin web context", () => {
    const { result } = renderHook(useUIEnvironment);
    act(() => query("(display-mode: standalone)").set(true));
    expect(result.current).toMatchObject({ runtime: "web", displayMode: "standalone" });
    expect(getAuthFlowSurface()).toBe("pwa");
    expect(getAuthRedirectUrl()).toBe(`${window.location.origin}/auth/callback`);
    act(() => query("(display-mode: standalone)").set(false));
    expect(result.current.displayMode).toBe("browser");
  });

  it("refreshes the iOS standalone compatibility value on foreground, not fullscreen", () => {
    query("(display-mode: fullscreen)").matches = true;
    const { result } = renderHook(useUIEnvironment);
    expect(result.current.displayMode).toBe("browser");
    act(() => {
      Object.assign(navigator, { standalone: true });
      window.dispatchEvent(new Event("pageshow"));
    });
    expect(result.current.displayMode).toBe("standalone");
  });

  it("updates new bands independently of the preserved 768px legacy threshold", () => {
    const { result } = renderHook(() => ({ environment: useUIEnvironment(), legacy: useBreakpoint() }));
    for (const [width, windowClass, isPhone] of [[599, "compact", true], [600, "medium", true], [767, "medium", true], [768, "medium", false], [1023, "medium", false], [1024, "expanded", false]] as const) {
      act(() => resize(width));
      expect(result.current.environment.windowClass).toBe(windowClass);
      expect(result.current.legacy.isPhone).toBe(isPhone);
    }
  });

  it("keeps visual keyboard and pinch geometry separate from runtime, layout class and scroller height", () => {
    const viewport = Object.assign(new EventTarget(), { width: 800, height: 900, offsetTop: 0, offsetLeft: 0, scale: 1 });
    vi.stubGlobal("visualViewport", viewport);
    resize(800, 900);
    const { result } = renderHook(() => { useAppViewportHeight(); return useUIEnvironment(); });
    act(() => {
      Object.assign(viewport, { width: 400, height: 320, offsetTop: 20, offsetLeft: 10, scale: 2 });
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toMatchObject({ runtime: "web", windowClass: "medium", layoutWidth: 800, layoutHeight: 900, visualWidth: 400, visualHeight: 320, visualScale: 2, visualOffsetTop: 20, visualOffsetLeft: 10 });
    expect(document.documentElement.style.getPropertyValue("--app-viewport-height")).toBe("900px");
  });

  it("reacts to mixed input and reduced motion without changing runtime or width", () => {
    const { result } = renderHook(useUIEnvironment);
    act(() => {
      query("(pointer: coarse)").set(true);
      query("(any-pointer: coarse)").set(true);
      query("(any-pointer: fine)").set(true);
      query("(any-hover: hover)").set(true);
      query("(prefers-reduced-motion: reduce)").set(true);
    });
    expect(result.current).toMatchObject({ runtime: "web", layoutWidth: 390, pointer: "coarse", anyCoarsePointer: true, anyFinePointer: true, hover: false, anyHover: true, reducedMotion: true });
  });

  it("falls back to usable web geometry and reduced effects without optional capabilities", () => {
    vi.stubGlobal("matchMedia", undefined);
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("unknown");
    const { result } = renderHook(useUIEnvironment);
    expect(result.current).toMatchObject({ runtime: "web", displayMode: "browser", visualWidth: 390, visualHeight: 844, visualScale: 1, pointer: "none", hover: false, reducedMotion: true, supportsMediaQueries: false, supportsVisualViewport: false });
    expect(getServerUIEnvironmentSnapshot()).toMatchObject({ runtime: "web", reducedMotion: true });
  });

  it("shares listeners, retains snapshot identity and removes subscriptions after the final consumer", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const first = renderHook(useUIEnvironment);
    const second = renderHook(useUIEnvironment);
    const initial = getUIEnvironmentSnapshot();
    act(() => window.dispatchEvent(new Event("resize")));
    expect(getUIEnvironmentSnapshot()).toBe(initial);
    expect(add.mock.calls.filter(([event]) => event === "resize")).toHaveLength(1);
    first.unmount();
    expect(remove.mock.calls.filter(([event]) => event === "resize")).toHaveLength(0);
    second.unmount();
    expect(remove.mock.calls.filter(([event]) => event === "resize")).toHaveLength(1);
  });

  it("does not re-render runtime-only consumers for visual viewport scroll", () => {
    const viewport = Object.assign(new EventTarget(), { width: 390, height: 844, offsetTop: 0, offsetLeft: 0, scale: 1 });
    vi.stubGlobal("visualViewport", viewport);
    let renders = 0;
    renderHook(() => { renders += 1; return usePlatform(); });
    const before = renders;
    act(() => { viewport.offsetTop = 20; viewport.dispatchEvent(new Event("scroll")); });
    expect(renders).toBe(before);
  });

  it("observes and cleans up older MediaQueryList addListener implementations", () => {
    const callbacks = new Set<() => void>();
    const oldMedia = { matches: false,
      addListener: (callback: () => void) => callbacks.add(callback),
      removeListener: (callback: () => void) => callbacks.delete(callback),
    };
    vi.stubGlobal("matchMedia", () => oldMedia);
    const { result, unmount } = renderHook(useUIEnvironment);
    act(() => { oldMedia.matches = true; callbacks.forEach((callback) => callback()); });
    expect(result.current.reducedMotion).toBe(true);
    expect(result.current.displayMode).toBe("standalone");
    unmount();
    expect(callbacks.size).toBe(0);
  });
});
