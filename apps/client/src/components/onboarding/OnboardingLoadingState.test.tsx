import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { BRACK_LOADER_TIMING } from "@/components/animations/brackLoaderTokens";
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

  it("uses one polite shared-book status and no fake percentage", () => {
    vi.useFakeTimers();
    const { container } = render(
      <OnboardingLoadingState message="Preparing your saved setup…" />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(BRACK_LOADER_TIMING.appearanceDelayMs));

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Preparing your saved setup…");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Opening your reading room")).toBeInTheDocument();
    expect(container.querySelector(".onboarding-loading__book .brack-loader__book"))
      .toBeInTheDocument();
    expect(container.querySelector(".onboarding-loading__trace")).not.toBeInTheDocument();
  });

  it("passes reduced motion to the shared book treatment", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<OnboardingLoadingState />);
    act(() => vi.advanceTimersByTime(BRACK_LOADER_TIMING.appearanceDelayMs));
    expect(container.querySelector(".onboarding-loading__book"))
      .toHaveAttribute("data-motion", "full");

    reducedMotionMock.mockReturnValue(true);
    rerender(<OnboardingLoadingState />);
    expect(container.querySelector(".onboarding-loading__book"))
      .toHaveAttribute("data-motion", "reduced");
  });

  it("does not hold ready onboarding navigation for decorative motion", () => {
    render(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <Routes>
          <Route
            path="/onboarding"
            element={
              <OnboardingRouteTransition
                to="/dashboard"
                message="Personalizing your dashboard…"
              />
            }
          />
          <Route path="/dashboard" element={<p>Dashboard ready</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard ready")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
