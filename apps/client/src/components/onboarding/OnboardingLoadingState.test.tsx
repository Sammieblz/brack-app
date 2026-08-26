import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { OnboardingLoadingState, OnboardingRouteTransition } from "./OnboardingLoadingState";

const reducedMotionMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: reducedMotionMock,
}));

describe("OnboardingLoadingState", () => {
  beforeEach(() => reducedMotionMock.mockReturnValue(false));
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("uses one polite status and no fake percentage", () => {
    render(<OnboardingLoadingState message="Preparing your saved setup…" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Preparing your saved setup…");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Opening your reading room")).toBeInTheDocument();
  });

  it("exposes the reactive reduced-motion state to its visual treatment", () => {
    const { container, rerender } = render(<OnboardingLoadingState />);
    expect(container.querySelector(".onboarding-loading")).toHaveAttribute("data-motion", "full");

    reducedMotionMock.mockReturnValue(true);
    rerender(<OnboardingLoadingState />);
    expect(container.querySelector(".onboarding-loading")).toHaveAttribute("data-motion", "reduced");
  });

  it("keeps the branded onboarding treatment through the post-save route transition", () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <Routes>
          <Route
            path="/onboarding"
            element={(
              <OnboardingRouteTransition
                to="/dashboard"
                message="Personalizing your dashboard…"
                minDisplayTime={950}
              />
            )}
          />
          <Route path="/dashboard" element={<p>Dashboard ready</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Personalizing your dashboard…");
    act(() => vi.advanceTimersByTime(949));
    expect(screen.queryByText("Dashboard ready")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Dashboard ready")).toBeInTheDocument();
  });
});
