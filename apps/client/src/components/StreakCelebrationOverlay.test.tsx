import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BRACK_STREAK_HAPPY_IMAGE } from "@/config/brackAssets";
import {
  STREAK_CELEBRATION_DURATION_MS,
  StreakCelebrationOverlay,
} from "@/components/StreakCelebrationOverlay";

const reducedMotionMock = vi.hoisted(() => vi.fn(() => false));
const triggerHapticMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: reducedMotionMock,
}));

vi.mock("@/hooks/useGSAP", () => ({
  useGSAP: vi.fn(),
}));

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({ triggerHaptic: triggerHapticMock }),
}));

const CelebrationHarness = ({ durationMs }: { durationMs?: number }) => {
  const [open, setOpen] = useState(true);
  const [backgroundClicks, setBackgroundClicks] = useState(0);

  return (
    <>
      <button autoFocus type="button" onClick={() => setBackgroundClicks((value) => value + 1)}>
        Underlying action {backgroundClicks}
      </button>
      <StreakCelebrationOverlay
        open={open}
        streak={7}
        durationMs={durationMs}
        onDismiss={() => setOpen(false)}
      />
    </>
  );
};

const FocusHarness = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open streak celebration</button>
      <StreakCelebrationOverlay
        open={open}
        streak={7}
        onDismiss={() => setOpen(false)}
      />
    </>
  );
};

describe("StreakCelebrationOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    reducedMotionMock.mockReturnValue(false);
    triggerHapticMock.mockClear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("presents the transparent happy flame as a spatial, borderless reveal", () => {
    render(<CelebrationHarness />);

    const overlay = screen.getByTestId("streak-celebration-overlay");
    const image = overlay.querySelector("img");
    const flameStage = screen.getByTestId("streak-celebration-flame-stage");

    expect(overlay).toHaveAttribute("data-brack-celebration-active", "streak");
    expect(image).toHaveAttribute("src", BRACK_STREAK_HAPPY_IMAGE);
    expect(image).toHaveAttribute("alt", "");
    expect(flameStage).toHaveStyle({ transformStyle: "preserve-3d" });
    expect(screen.getByTestId("streak-celebration-stage-perspective"))
      .toHaveStyle({ perspective: "1000px" });
    expect(image?.className).not.toContain("border");
  });

  it("dismisses at about two seconds and removes the pointer-blocking layer", () => {
    render(<CelebrationHarness />);

    act(() => vi.advanceTimersByTime(STREAK_CELEBRATION_DURATION_MS - 1));
    expect(screen.getByTestId("streak-celebration-overlay")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("streak-celebration-overlay")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /underlying action 0/i }));
    expect(screen.getByRole("button", { name: /underlying action 1/i })).toBeInTheDocument();
  });

  it("dismisses immediately when the reader taps anywhere on the overlay", () => {
    render(<CelebrationHarness />);

    fireEvent.click(screen.getByText("Streak secured!"));

    expect(screen.queryByTestId("streak-celebration-overlay")).not.toBeInTheDocument();
  });

  it("uses a modal focus boundary and restores focus after Escape", () => {
    render(<FocusHarness />);
    const underlying = screen.getByRole("button", { name: /open streak celebration/i });
    underlying.focus();
    fireEvent.click(underlying);
    const dismissButton = screen.getByRole("button", { name: /dismiss streak celebration/i });

    expect(dismissButton).toHaveFocus();
    fireEvent.keyDown(dismissButton, { key: "Escape" });
    act(() => vi.advanceTimersByTime(0));

    expect(screen.queryByTestId("streak-celebration-overlay")).not.toBeInTheDocument();
    expect(underlying).toHaveFocus();
  });

  it("labels the modal once and provides a 44px keyboard dismiss control", () => {
    render(<CelebrationHarness />);

    const dialog = screen.getByRole("dialog", { name: /daily reading streak completed/i });
    expect(dialog).toHaveAccessibleDescription(/7 day reading streak is secure/i);
    const dismissButton = screen.getByRole("button", { name: /dismiss streak celebration/i });
    expect(dismissButton).toHaveClass("h-11", "w-11");

    fireEvent.click(dismissButton);
    expect(screen.queryByTestId("streak-celebration-overlay")).not.toBeInTheDocument();
  });

  it("uses a static, spark-free presentation for reduced motion", () => {
    reducedMotionMock.mockReturnValue(true);
    render(<CelebrationHarness />);

    const overlay = screen.getByTestId("streak-celebration-overlay");
    expect(overlay).toHaveAttribute("data-motion", "reduced");
    expect(overlay.querySelectorAll("[data-streak-spark]")).toHaveLength(0);
    expect(triggerHapticMock).not.toHaveBeenCalled();
  });

  it("fires one success haptic for the discrete full-motion arrival", () => {
    const { rerender } = render(
      <StreakCelebrationOverlay open streak={4} onDismiss={vi.fn()} />,
    );

    expect(triggerHapticMock).toHaveBeenCalledTimes(1);
    expect(triggerHapticMock).toHaveBeenCalledWith("success");

    rerender(<StreakCelebrationOverlay open streak={5} onDismiss={vi.fn()} />);
    expect(triggerHapticMock).toHaveBeenCalledTimes(1);
  });

  it("clears its dismissal timer when removed early", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <StreakCelebrationOverlay open streak={3} onDismiss={onDismiss} />,
    );

    rerender(<StreakCelebrationOverlay open={false} streak={3} onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(STREAK_CELEBRATION_DURATION_MS));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
