import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, type CSSProperties } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppHeader } from "./useAppHeader";

const HEADER_HEIGHT = "--app-header-height";
const observers: HeaderResizeObserver[] = [];

class HeaderResizeObserver implements ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }

  deliver(entries: ResizeObserverEntry[]) {
    this.callback(entries, this);
  }
}

const resizeEntry = (target: Element, height: number): ResizeObserverEntry => ({
  target,
  borderBoxSize: [{ blockSize: height, inlineSize: 800 }],
  // Deliberately different: content height excludes the header padding/border.
  contentRect: new DOMRect(0, 0, 800, height - 32),
  contentBoxSize: [{ blockSize: height - 32, inlineSize: 800 }],
  devicePixelContentBoxSize: [],
});

const Header = () => <header ref={useAppHeader()}>Reader Journey</header>;

describe("useAppHeader", () => {
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal("ResizeObserver", HeaderResizeObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, 800, 137.5));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("publishes the initial border-box height and changed measurements only", () => {
    render(<main data-app-scroll-container="true"><Header /></main>);
    const owner = screen.getByRole("main");
    const header = screen.getByRole("banner");
    expect(owner.style.getPropertyValue(HEADER_HEIGHT)).toBe("137.5px");
    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledExactlyOnceWith(header, { box: "border-box" });

    const publish = vi.spyOn(owner.style, "setProperty");
    observers[0].deliver([resizeEntry(header, 137.5)]);
    expect(publish).not.toHaveBeenCalled();

    observers[0].deliver([resizeEntry(header, 181.25)]);
    expect(owner.style.getPropertyValue(HEADER_HEIGHT)).toBe("181.25px");
    observers[0].deliver([resizeEntry(header, 181.25)]);
    expect(publish).toHaveBeenCalledExactlyOnceWith(HEADER_HEIGHT, "181.25px");
  });

  it("remeasures the border box when a resize entry has no border-box sizes", () => {
    render(<main data-app-scroll-container="true"><Header /></main>);
    const header = screen.getByRole("banner");
    vi.spyOn(header, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 800, 205.5));
    observers[0].deliver([{ ...resizeEntry(header, 150), borderBoxSize: [] }]);
    expect(screen.getByRole("main").style.getPropertyValue(HEADER_HEIGHT)).toBe("205.5px");
  });

  it("ignores empty observer deliveries", () => {
    render(<main data-app-scroll-container="true"><Header /></main>);
    const owner = screen.getByRole("main");
    const publish = vi.spyOn(owner.style, "setProperty");
    observers[0].deliver([]);
    expect(publish).not.toHaveBeenCalled();
    expect(owner.style.getPropertyValue(HEADER_HEIGHT)).toBe("137.5px");
  });

  it("publishes to the nearest marked owner, not outer or unrelated scrollers", () => {
    render(
      <div data-testid="outer" data-app-scroll-container="true">
        <main data-app-scroll-container="true"><div><Header /></div></main>
        <aside data-app-scroll-container="true" />
      </div>,
    );
    expect(screen.getByRole("main").style.getPropertyValue(HEADER_HEIGHT)).toBe("137.5px");
    for (const element of [screen.getByTestId("outer"), screen.getByRole("complementary"), document.documentElement]) {
      expect(element.style.getPropertyValue(HEADER_HEIGHT)).toBe("");
    }
  });

  it("does not subscribe to scroll or remeasure on scroll reversals", () => {
    const listen = vi.spyOn(EventTarget.prototype, "addEventListener");
    render(<main data-app-scroll-container="true"><Header /></main>);
    const owner = screen.getByRole("main");
    const header = screen.getByRole("banner");
    const targets = [owner, header, window];
    const measurement = vi.spyOn(header, "getBoundingClientRect");
    const initialMeasurements = measurement.mock.calls.length;
    const publish = vi.spyOn(owner.style, "setProperty");

    for (const scrollTop of [49, 51, 80, 51, 49, 0]) {
      owner.scrollTop = scrollTop;
      for (const target of targets) fireEvent.scroll(target);
    }

    // React's delegated listeners on its render root are not hook listeners.
    const scrollSubscriptions = listen.mock.calls.filter(([type], index) =>
      type === "scroll" && targets.some((target) => target === listen.mock.contexts[index]),
    );
    expect(scrollSubscriptions).toEqual([]);
    expect(measurement).toHaveBeenCalledTimes(initialMeasurements);
    expect(publish).not.toHaveBeenCalled();
  });

  it.each(["", "64px"])("restores the owner's previous height (%j) and disconnects on unmount", (previous) => {
    const style = { [HEADER_HEIGHT]: previous } as CSSProperties;
    const { rerender } = render(<main data-app-scroll-container="true" style={style}><Header /></main>);
    const owner = screen.getByRole("main");
    expect(owner.style.getPropertyValue(HEADER_HEIGHT)).toBe("137.5px");

    rerender(<main data-app-scroll-container="true" style={style} />);
    expect(observers[0].disconnect).toHaveBeenCalledExactlyOnceWith();
    expect(owner.style.getPropertyValue(HEADER_HEIGHT)).toBe(previous);
  });

  it("keeps only the current observer active through StrictMode's effect replay", () => {
    const style = { [HEADER_HEIGHT]: "64px" } as CSSProperties;
    const { unmount } = render(
      <StrictMode><main data-app-scroll-container="true" style={style}><Header /></main></StrictMode>,
    );
    const owner = screen.getByRole("main");
    expect(observers).toHaveLength(2);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(observers[1].disconnect).not.toHaveBeenCalled();
    observers[1].deliver([resizeEntry(screen.getByRole("banner"), 181.25)]);
    expect(owner.style.getPropertyValue(HEADER_HEIGHT)).toBe("181.25px");

    unmount();
    for (const observer of observers) expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(owner.style.getPropertyValue(HEADER_HEIGHT)).toBe("64px");
  });

  it("does not create an observer or publish outside the application shell", () => {
    render(<main><Header /></main>);
    expect(observers).toHaveLength(0);
    expect(screen.getByRole("main").style.getPropertyValue(HEADER_HEIGHT)).toBe("");
    expect(document.documentElement.style.getPropertyValue(HEADER_HEIGHT)).toBe("");
  });
});
