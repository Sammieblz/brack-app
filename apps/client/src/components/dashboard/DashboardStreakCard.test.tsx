import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DashboardStreakCard,
  type DashboardStreakCardProps,
} from "./DashboardStreakCard";
import {
  BRACK_STREAK_HAPPY_IMAGE,
  BRACK_STREAK_SAD_IMAGE,
} from "@/config/brackAssets";

const nowMs = Date.parse("2026-08-16T16:00:00.000Z");
const freeze = {
  code: "streak_freeze",
  display_name: "Streak Freeze",
  description: "Protect a missed day.",
  gold_leaves_cost: 12,
  max_inventory: 3,
  quantity: 2,
  can_purchase: true,
};

const baseProps = {
  streak: {
    currentStreak: 6,
    longestStreak: 12,
    lastReadingDate: "2026-08-16",
    freezeUsedAt: null,
  },
  timezone: "America/New_York",
  serverTime: "2026-08-16T16:00:00.000Z",
  receivedAt: "2026-08-16T16:00:00.000Z",
  source: "live" as const,
  provisional: false,
  hasCurrentBook: true,
  showJourney: true,
  league: null,
  leagueCutoff: null,
  freeze,
  canMutateFreeze: true,
  usingFreeze: false,
  onRead: vi.fn(),
  onUseFreeze: vi.fn(),
  onOpenShop: vi.fn(),
  nowMs,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderCard = (overrides: Partial<DashboardStreakCardProps> = {}) => render(
  <MemoryRouter>
    <DashboardStreakCard {...baseProps} {...overrides} />
  </MemoryRouter>,
);

describe("DashboardStreakCard", () => {
  it("restores the happy Brack artwork when today's reading is secure", () => {
    renderCard();

    const artwork = screen.getByRole("img", { name: /happy brack flame/i });
    expect(artwork).toHaveAttribute("src", BRACK_STREAK_HAPPY_IMAGE);
    expect(artwork).toHaveClass("streak-art-float");
    expect(screen.getByTestId("streak-art-stage")).not.toHaveClass("border");
    expect(screen.getByText("Your flame is bright")).toBeVisible();
    expect(screen.getByText("Secure today")).toBeVisible();
    expect(screen.queryByRole("button", { name: /use a freeze/i })).not.toBeInTheDocument();
  });

  it("shows the sad artwork and a direct reading action when an active streak is at risk", async () => {
    const onRead = vi.fn();
    const user = userEvent.setup();
    renderCard({
      streak: { ...baseProps.streak, lastReadingDate: "2026-08-15" },
      onRead,
    });

    const artwork = screen.getByRole("img", { name: /sad brack flame/i });
    expect(artwork).toHaveAttribute("src", BRACK_STREAK_SAD_IMAGE);
    expect(screen.getByText("Your flame needs you")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Read now" }));
    expect(onRead).toHaveBeenCalledOnce();
  });

  it("offers a server-backed Freeze only during the at-risk window", async () => {
    const onUseFreeze = vi.fn();
    const user = userEvent.setup();
    renderCard({
      streak: { ...baseProps.streak, lastReadingDate: "2026-08-15" },
      onUseFreeze,
    });

    await user.click(screen.getByRole("button", { name: "Use a Freeze" }));
    expect(onUseFreeze).toHaveBeenCalledOnce();
    expect(screen.getByText(/spent only after Brack confirms an eligible missed reading day/i)).toBeVisible();
  });

  it("keeps cached inventory visible but prevents consumption", () => {
    renderCard({
      streak: { ...baseProps.streak, lastReadingDate: "2026-08-15" },
      source: "cached",
      canMutateFreeze: false,
    });

    expect(screen.getByText("Saved status")).toBeVisible();
    expect(screen.getByText(/2 of 3 Freezes stored/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Reconnect to use" })).toBeDisabled();
  });

  it("never presents unknown inventory as a zero balance", () => {
    renderCard({
      streak: { ...baseProps.streak, lastReadingDate: "2026-08-15" },
      freeze: null,
    });

    expect(screen.getByRole("button", { name: "Freeze inventory unavailable" })).toBeDisabled();
    expect(screen.getByText(/could not be refreshed/i)).toBeVisible();
    expect(screen.queryByText(/0 of 0 Freezes/i)).not.toBeInTheDocument();
  });

  it("explains the streak and currency rules without cluttering the default card", async () => {
    const user = userEvent.setup();
    renderCard();

    expect(screen.queryByText(/Gold Leaves buy Freezes/i)).not.toBeVisible();
    await user.click(screen.getByText("How streaks and Freezes work"));
    expect(screen.getByText(/Gold Leaves buy Freezes in the Journey Shop/i)).toBeVisible();
    expect(screen.getByText(/never consumed automatically/i)).toBeVisible();
  });
});
