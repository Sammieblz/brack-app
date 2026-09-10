import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

import { LandingReveal } from "./LandingReveal";

describe("LandingReveal", () => {
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
});
