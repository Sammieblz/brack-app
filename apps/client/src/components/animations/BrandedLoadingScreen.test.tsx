import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BRACK_LOADER_TIMING } from "./brackLoaderTokens";
import { BrandedLoadingScreen } from "./BrandedLoadingScreen";

const reducedMotionMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: reducedMotionMock,
}));

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  reducedMotionMock.mockReturnValue(false);
});

describe("BrandedLoadingScreen", () => {
  it("uses the shared fullscreen book and determinate progress at narrow widths", () => {
    render(
      <BrandedLoadingScreen
        message="Importing your library..."
        progress={42}
        appearanceDelayMs={0}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Importing your library...");
    expect(status).toHaveAttribute("data-size", "lg");
    expect(status).toHaveAttribute("data-variant", "fullscreen");
    expect(document.querySelector(".brack-loader__book")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Loading progress" }))
      .toHaveAttribute("aria-valuenow", "42");
  });

  it("does not flash for work that completes inside the threshold", () => {
    vi.useFakeTimers();
    const { rerender } = render(<BrandedLoadingScreen active />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(BRACK_LOADER_TIMING.appearanceDelayMs - 1));
    rerender(<BrandedLoadingScreen active={false} />);
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("appears for a sustained wait and exits immediately when work completes", () => {
    vi.useFakeTimers();
    const { rerender } = render(<BrandedLoadingScreen active />);
    act(() => vi.advanceTimersByTime(BRACK_LOADER_TIMING.appearanceDelayMs));
    expect(screen.getByRole("status")).toBeInTheDocument();

    rerender(<BrandedLoadingScreen active={false} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("never invents progress for an indeterminate operation", () => {
    render(<BrandedLoadingScreen appearanceDelayMs={0} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
