import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const preference = vi.hoisted(() => ({ reduced: true }));
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => preference.reduced }));

import { LandingReadingStepArt } from "./LandingReadingStepArt";

describe("LandingReadingStepArt", () => {
  let scrollRoot: HTMLDivElement;
  let observedRoot: Element | Document | null | undefined;

  beforeEach(() => {
    preference.reduced = true;
    observedRoot = undefined;
    scrollRoot = document.createElement("div");
    scrollRoot.id = "root";
    document.body.appendChild(scrollRoot);
    vi.stubGlobal("IntersectionObserver", class {
      constructor(_callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observedRoot = options?.root;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    cleanup();
    scrollRoot.remove();
    vi.unstubAllGlobals();
  });

  it.each([
    ["resume", "notebook"],
    ["record", "pencil"],
    ["understand", "chart"],
  ] as const)("uses existing decorative %s artwork without motion when requested", async (step, file) => {
    const { container } = render(<LandingReadingStepArt step={step} />, { container: scrollRoot });
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", `/3dicons/3dicons-${file}-front-clay.webp`);
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("width", "500");
    expect(image).toHaveAttribute("height", "500");
    expect(image?.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    await waitFor(() => expect(image).toHaveStyle({ transform: "none" }));
  });

  it("observes Brack's scroll root and settles immediately if reduced motion is enabled", async () => {
    preference.reduced = false;
    const { container, rerender } = render(<LandingReadingStepArt step="resume" />, { container: scrollRoot });
    const image = container.querySelector("img");
    expect(observedRoot).toBe(scrollRoot);
    expect(image?.style.transform).toContain("rotate(-5deg)");

    preference.reduced = true;
    rerender(<LandingReadingStepArt step="resume" />);
    await waitFor(() => expect(image).toHaveStyle({ transform: "none" }));
  });
});
