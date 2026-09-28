import { getRuntimePlatform, isStandalonePwaRuntime } from "./platform";
import type { BrackRuntimePlatform } from "@/types/desktop";

// New adaptive surfaces use these bands. Legacy 768px consumers keep their
// existing threshold until their presentation is migrated and verified.
export const UI_WINDOW_BREAKPOINTS = { medium: 600, expanded: 1024 } as const;

export interface UIEnvironment {
  runtime: BrackRuntimePlatform;
  displayMode: "browser" | "standalone" | "app";
  windowClass: "compact" | "medium" | "expanded";
  layoutWidth: number;
  layoutHeight: number;
  visualWidth: number;
  visualHeight: number;
  visualOffsetTop: number;
  visualOffsetLeft: number;
  visualScale: number;
  pointer: "coarse" | "fine" | "none";
  anyCoarsePointer: boolean;
  anyFinePointer: boolean;
  hover: boolean;
  anyHover: boolean;
  reducedMotion: boolean;
  supportsMediaQueries: boolean;
  supportsVisualViewport: boolean;
}

const serverSnapshot: UIEnvironment = {
  runtime: "web", displayMode: "browser", windowClass: "compact",
  layoutWidth: 0, layoutHeight: 0, visualWidth: 0, visualHeight: 0,
  visualOffsetTop: 0, visualOffsetLeft: 0, visualScale: 1,
  pointer: "none", anyCoarsePointer: false, anyFinePointer: false,
  hover: false, anyHover: false, reducedMotion: true,
  supportsMediaQueries: false, supportsVisualViewport: false,
};

const mediaQueries = [
  "(display-mode: standalone)", "(pointer: coarse)", "(pointer: fine)",
  "(any-pointer: coarse)", "(any-pointer: fine)", "(hover: hover)",
  "(any-hover: hover)", "(prefers-reduced-motion: reduce)",
] as const;

const getMedia = (query: string): MediaQueryList | undefined => window.matchMedia?.(query);
const finite = (value: number | undefined, fallback: number) =>
  value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;

const readEnvironment = (): UIEnvironment => {
  if (typeof window === "undefined") return serverSnapshot;
  const runtime = getRuntimePlatform();
  const layoutWidth = finite(window.innerWidth, 0);
  const layoutHeight = finite(window.innerHeight, 0);
  const viewport = window.visualViewport;
  const supportsMediaQueries = typeof window.matchMedia === "function";
  const matches = (query: string) => Boolean(getMedia(query)?.matches);

  return {
    runtime,
    displayMode: runtime !== "web" ? "app" : isStandalonePwaRuntime() ? "standalone" : "browser",
    windowClass: layoutWidth < UI_WINDOW_BREAKPOINTS.medium ? "compact"
      : layoutWidth < UI_WINDOW_BREAKPOINTS.expanded ? "medium" : "expanded",
    layoutWidth, layoutHeight,
    visualWidth: finite(viewport?.width, layoutWidth),
    visualHeight: finite(viewport?.height, layoutHeight),
    visualOffsetTop: finite(viewport?.offsetTop, 0),
    visualOffsetLeft: finite(viewport?.offsetLeft, 0),
    visualScale: viewport?.scale && viewport.scale > 0 && Number.isFinite(viewport.scale) ? viewport.scale : 1,
    pointer: matches("(pointer: coarse)") ? "coarse" : matches("(pointer: fine)") ? "fine" : "none",
    anyCoarsePointer: matches("(any-pointer: coarse)"),
    anyFinePointer: matches("(any-pointer: fine)"),
    hover: matches("(hover: hover)"),
    anyHover: matches("(any-hover: hover)"),
    reducedMotion: !supportsMediaQueries || matches("(prefers-reduced-motion: reduce)"),
    supportsMediaQueries,
    supportsVisualViewport: Boolean(viewport),
  };
};

let snapshot = serverSnapshot;
const listeners = new Set<() => void>();
let stopListening: (() => void) | undefined;

const refresh = () => {
  const next = readEnvironment();
  if ((Object.keys(next) as Array<keyof UIEnvironment>).every((key) => next[key] === snapshot[key])) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
};

export const getUIEnvironmentSnapshot = () => {
  // Read before the first render; native clients never start with a web frame.
  // A stable cached object satisfies useSyncExternalStore's identity contract.
  if (listeners.size === 0) refresh();
  return snapshot;
};

export const getServerUIEnvironmentSnapshot = () => serverSnapshot;

export const subscribeUIEnvironment = (listener: () => void) => {
  listeners.add(listener);
  if (!stopListening && typeof window !== "undefined") {
    const viewport = window.visualViewport;
    const media = mediaQueries.map(getMedia).filter((query): query is MediaQueryList => Boolean(query));
    const windowEvents = ["resize", "orientationchange", "pageshow", "focus", "appinstalled"];
    windowEvents.forEach((event) => window.addEventListener(event, refresh));
    document.addEventListener("visibilitychange", refresh);
    viewport?.addEventListener("resize", refresh);
    viewport?.addEventListener("scroll", refresh);
    media.forEach((query) => {
      if (query.addEventListener) query.addEventListener("change", refresh);
      else query.addListener?.(refresh);
    });
    stopListening = () => {
      windowEvents.forEach((event) => window.removeEventListener(event, refresh));
      document.removeEventListener("visibilitychange", refresh);
      viewport?.removeEventListener("resize", refresh);
      viewport?.removeEventListener("scroll", refresh);
      media.forEach((query) => {
        if (query.removeEventListener) query.removeEventListener("change", refresh);
        else query.removeListener?.(refresh);
      });
    };
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopListening?.();
      stopListening = undefined;
    }
  };
};
