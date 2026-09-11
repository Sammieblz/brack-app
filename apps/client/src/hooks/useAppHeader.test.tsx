import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppHeader } from "./useAppHeader";

let resize: ResizeObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();

const Header = () => <header ref={useAppHeader()}>Reader Journey</header>;

describe("useAppHeader", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { resize = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 137.5 } as DOMRect);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("measures only the owning header and follows late layout changes without scroll listeners", () => {
    const { container, rerender } = render(
      <main data-app-scroll-container="true"><div><Header /></div><section>Books</section></main>,
    );
    const owner = container.querySelector("main")!;
    const header = container.querySelector("header")!;
    expect(owner.style.getPropertyValue("--app-header-height")).toBe("137.5px");
    expect(observe).toHaveBeenCalledWith(header, { box: "border-box" });

    const publish = vi.spyOn(owner.style, "setProperty");
    const entry = { borderBoxSize: [{ blockSize: 181.25 }] } as unknown as ResizeObserverEntry;
    resize([entry], {} as ResizeObserver);
    expect(owner.style.getPropertyValue("--app-header-height")).toBe("181.25px");
    resize([entry], {} as ResizeObserver);
    expect(publish).toHaveBeenCalledTimes(1);

    header.dispatchEvent(new Event("scroll"));
    owner.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));
    expect(publish).toHaveBeenCalledTimes(1);

    rerender(<main data-app-scroll-container="true"><section>Books</section></main>);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(owner.style.getPropertyValue("--app-header-height")).toBe("");
  });

  it("does not change a document or unrelated scroller outside MobileLayout", () => {
    render(<Header />);
    expect(observe).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue("--app-header-height")).toBe("");
  });
});
