import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BRACK_STREAK_HAPPY_IMAGE, BRACK_STREAK_SAD_IMAGE } from "@/config/brackAssets";

const { triggerHapticMock, motionPreference } = vi.hoisted(() => ({
  triggerHapticMock: vi.fn(),
  motionPreference: { reduced: false },
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => motionPreference.reduced,
}));

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({ triggerHaptic: triggerHapticMock }),
}));

import { LandingGamificationShowcase } from "./LandingGamificationShowcase";

describe("LandingGamificationShowcase", () => {
  beforeEach(() => {
    triggerHapticMock.mockReset();
    motionPreference.reduced = false;
  });

  it("lets keyboard users preview both flame moods", async () => {
    const user = userEvent.setup();
    render(<LandingGamificationShowcase />);

    const flameButton = screen.getByRole("button", {
      name: "Preview missed-day streak state",
    });
    const flameImage = () => flameButton.querySelector("img");

    expect(flameButton).toHaveAttribute("aria-pressed", "false");
    expect(flameImage()).toHaveAttribute("src", BRACK_STREAK_HAPPY_IMAGE);

    flameButton.focus();
    await user.keyboard(" ");

    await waitFor(() => {
      expect(flameButton).toHaveAttribute("aria-pressed", "true");
      expect(flameImage()).toHaveAttribute("src", BRACK_STREAK_SAD_IMAGE);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Showing the sad missed-day flame");
    expect(flameButton).toHaveAttribute("data-motion", "instant");

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(flameButton).toHaveAttribute("aria-pressed", "false");
      expect(flameImage()).toHaveAttribute("src", BRACK_STREAK_HAPPY_IMAGE);
    });
    expect(triggerHapticMock).toHaveBeenCalledTimes(2);
    expect(flameButton).toHaveAttribute("data-motion", "instant");
  });

  it("exposes the Ink and Gold Leaves flourishes as named buttons", async () => {
    const user = userEvent.setup();
    render(<LandingGamificationShowcase />);

    const inkButton = screen.getByRole("button", { name: "Animate Lifetime Ink" });
    const leavesButton = screen.getByRole("button", { name: "Animate Gold Leaves" });

    await user.click(inkButton);
    leavesButton.focus();
    await user.keyboard("{Enter}");

    expect(triggerHapticMock).toHaveBeenNthCalledWith(1, "light");
    expect(triggerHapticMock).toHaveBeenNthCalledWith(2, "light");
    expect(inkButton).not.toHaveAttribute("aria-pressed");
    expect(leavesButton).not.toHaveAttribute("aria-pressed");
    expect(inkButton).toHaveAttribute("data-motion", "animated");
    expect(leavesButton).toHaveAttribute("data-motion", "instant");
    expect(leavesButton.querySelector("[aria-hidden='true']")).toBeNull();
  });

  it("interrupts pointer flourishes when the same controls are activated by keyboard", async () => {
    const user = userEvent.setup();
    render(<LandingGamificationShowcase />);

    const flameButton = screen.getByRole("button", { name: "Preview missed-day streak state" });
    await user.click(flameButton);
    expect(flameButton).toHaveAttribute("data-motion", "animated");
    expect(flameButton).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{Enter}");
    expect(flameButton).toHaveAttribute("data-motion", "instant");
    expect(flameButton).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => {
      expect(flameButton.querySelectorAll("img")).toHaveLength(1);
      expect(flameButton.querySelector("img")).toHaveAttribute("src", BRACK_STREAK_HAPPY_IMAGE);
    });

    for (const name of ["Animate Lifetime Ink", "Animate Gold Leaves"]) {
      const button = screen.getByRole("button", { name });
      await user.click(button);
      expect(button).toHaveAttribute("data-motion", "animated");
      expect(button.querySelector("[aria-hidden='true']")).not.toBeNull();

      await user.keyboard("{Enter}");
      expect(button).toHaveAttribute("data-motion", "instant");
      expect(button.querySelector("[aria-hidden='true']")).toBeNull();
    }
  });

  it("keeps pointer activation immediate when reduced motion is requested", async () => {
    motionPreference.reduced = true;
    const user = userEvent.setup();
    render(<LandingGamificationShowcase />);

    for (const name of ["Preview missed-day streak state", "Animate Lifetime Ink", "Animate Gold Leaves"]) {
      const button = screen.getByRole("button", { name });
      await user.click(button);
      expect(button).toHaveAttribute("data-motion", "instant");
    }

    expect(screen.getByRole("status")).toHaveTextContent("Showing the sad missed-day flame");
  });
});
