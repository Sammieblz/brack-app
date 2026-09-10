import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const preference = vi.hoisted(() => ({ reduced: true }));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => preference.reduced,
}));

import { LandingReveal } from "./LandingReveal";

describe("LandingReveal", () => {
  beforeEach(() => {
    preference.reduced = true;
    // Keep the group offscreen. Real viewport entry is covered in Playwright.
    vi.stubGlobal("IntersectionObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders content immediately when reduced motion is requested", () => {
    render(
      <LandingReveal>
        <p>Always readable</p>
      </LandingReveal>,
    );

    const content = screen.getByText("Always readable");
    expect(content).toBeVisible();
    expect(content.parentElement).toHaveAttribute("data-motion", "reduced");
    expect(content.parentElement).not.toHaveStyle({ opacity: "0" });
  });

  it("bypasses the entrance and its delay when a child receives keyboard focus", async () => {
    preference.reduced = false;
    render(<LandingReveal delay={0.15}><button>Get started</button></LandingReveal>);
    const button = screen.getByRole("button", { name: "Get started" });
    const group = button.parentElement;
    expect(group).toHaveStyle({ opacity: "0" });

    fireEvent.focus(button);
    await waitFor(() => expect(group).toHaveStyle({ opacity: "1", transform: "none" }));
    fireEvent.blur(button);
    expect(group).toHaveStyle({ opacity: "1" });
  });

  it("reveals an offscreen group when reduced motion is enabled after mount", async () => {
    preference.reduced = false;
    const { rerender } = render(<LandingReveal><p>Reading circle</p></LandingReveal>);
    const group = screen.getByText("Reading circle").parentElement;
    expect(group).toHaveStyle({ opacity: "0" });

    preference.reduced = true;
    rerender(<LandingReveal><p>Reading circle</p></LandingReveal>);
    await waitFor(() => expect(group).toHaveStyle({ opacity: "1", transform: "none" }));
    expect(group).toHaveAttribute("data-motion", "reduced");
  });
});
