import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  it("uses the shared branded loader and dimensional progress at narrow widths", () => {
    vi.useFakeTimers();
    render(
      <BrandedLoadingScreen
        message="Preparing your reading journey..."
        progress={42}
        minDisplayTime={10_000}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Preparing your reading journey...");
    expect(status).toHaveAttribute("data-size", "lg");
    expect(status.closest(".fixed")).toHaveClass("p-4");

    const progress = screen.getByRole("progressbar", { name: "Loading progress" });
    expect(progress).toHaveAttribute("aria-valuenow", "42");
    expect(progress).toHaveAttribute("data-variant", "dimensional");
    expect(progress).toHaveClass("max-w-[calc(100%_-_2rem)]");
  });

  it("waits for the full-motion exit before completing", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<BrandedLoadingScreen minDisplayTime={100} onComplete={onComplete} />);

    act(() => vi.advanceTimersByTime(100));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(199));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("completes without an exit delay when motion is reduced", () => {
    vi.useFakeTimers();
    reducedMotionMock.mockReturnValue(true);
    const onComplete = vi.fn();
    render(<BrandedLoadingScreen minDisplayTime={100} onComplete={onComplete} />);

    act(() => vi.advanceTimersByTime(100));
    act(() => vi.advanceTimersByTime(1));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("clears a pending completion callback when unmounted", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const { unmount } = render(
      <BrandedLoadingScreen minDisplayTime={100} onComplete={onComplete} />,
    );

    act(() => vi.advanceTimersByTime(100));
    unmount();
    act(() => vi.advanceTimersByTime(200));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
