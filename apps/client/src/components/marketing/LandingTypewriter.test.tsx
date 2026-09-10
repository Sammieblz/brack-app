import { StrictMode } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const preference = vi.hoisted(() => ({ reduced: false }));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => preference.reduced,
}));

const headline = "A reading life deserves a record.";

describe("LandingTypewriter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    preference.reduced = false;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("announces the complete heading while typing once, including under StrictMode", async () => {
    const { LandingTypewriter } = await import("./LandingTypewriter");
    const renderHeadline = (className?: string) => (
      <StrictMode>
        <h1>
          <LandingTypewriter text={headline} className={className} />
        </h1>
      </StrictMode>
    );
    const { container, rerender, unmount } = render(renderHeadline());
    const typewriter = () => container.querySelector(".landing-typewriter");

    expect(screen.getByRole("heading", { name: headline })).toBeVisible();
    expect(typewriter()).toHaveAttribute("data-typing", "true");
    // All letters exist from the start; revealing them cannot reflow the title.
    expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent(headline);

    act(() => vi.advanceTimersByTime(2500));
    expect(typewriter()).toHaveAttribute("data-typing", "false");

    rerender(renderHeadline("different-theme"));
    expect(typewriter()).toHaveAttribute("data-typing", "false");

    unmount();
    const returned = render(renderHeadline());
    expect(returned.container.querySelector(".landing-typewriter")).toHaveAttribute("data-typing", "false");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up an interrupted entry and does not replay on a route return", async () => {
    const { LandingTypewriter } = await import("./LandingTypewriter");
    const firstEntry = render(<LandingTypewriter text={headline} />);
    expect(firstEntry.container.firstChild).toHaveAttribute("data-typing", "true");

    firstEntry.unmount();
    expect(vi.getTimerCount()).toBe(0);

    const returned = render(<LandingTypewriter text={headline} />);
    expect(returned.container.firstChild).toHaveAttribute("data-typing", "false");
  });

  it("immediately completes for reduced motion and cannot replay when motion is restored", async () => {
    const { LandingTypewriter } = await import("./LandingTypewriter");
    const { container, rerender } = render(<LandingTypewriter text={headline} />);
    expect(container.firstChild).toHaveAttribute("data-typing", "true");

    preference.reduced = true;
    rerender(<LandingTypewriter text={headline} />);
    expect(container.firstChild).toHaveAttribute("data-typing", "false");
    expect(vi.getTimerCount()).toBe(0);

    preference.reduced = false;
    rerender(<LandingTypewriter text={headline} />);
    expect(container.firstChild).toHaveAttribute("data-typing", "false");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows the finished text on first entry when reduced motion is already enabled", async () => {
    preference.reduced = true;
    const { LandingTypewriter } = await import("./LandingTypewriter");
    const { container } = render(<LandingTypewriter text={headline} />);

    expect(container.firstChild).toHaveAttribute("data-typing", "false");
    expect(vi.getTimerCount()).toBe(0);
  });
});
