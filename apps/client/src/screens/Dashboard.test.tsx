import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MomentumCard } from "./Dashboard";

const baseProps = {
  streak: {
    currentStreak: 6,
    longestStreak: 12,
    lastReadingDate: "2026-08-10",
    freezeUsedAt: null,
  },
  showJourney: true,
  league: null,
  leagueCutoff: null,
  canMutateFreeze: false,
  usingFreeze: false,
  onUseFreeze: vi.fn(),
  onOpenShop: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Dashboard Momentum", () => {
  it("renders an unavailable inventory state without claiming zero Freezes", () => {
    render(
      <MemoryRouter>
        <MomentumCard {...baseProps} freeze={null} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Inventory unavailable" })).toBeDisabled();
    expect(screen.getByText(/reconnect and refresh to check/i)).toBeVisible();
    expect(screen.queryByText(/^0 Freezes$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/min today/i)).not.toBeInTheDocument();
  });

  it("shows cached known inventory but prevents consumption", () => {
    render(
      <MemoryRouter>
        <MomentumCard
          {...baseProps}
          freeze={{
            code: "streak_freeze",
            display_name: "Streak Freeze",
            description: "Protect a missed day.",
            gold_leaves_cost: 12,
            max_inventory: 3,
            quantity: 2,
            can_purchase: true,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("2 Freezes")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reconnect to use" })).toBeDisabled();
    expect(screen.getByText(/cached count only/i)).toBeVisible();
  });

  it("defers live Freeze eligibility to the server-backed action", async () => {
    const onUseFreeze = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MomentumCard
          {...baseProps}
          canMutateFreeze
          onUseFreeze={onUseFreeze}
          freeze={{
            code: "streak_freeze",
            display_name: "Streak Freeze",
            description: "Protect a missed day.",
            gold_leaves_cost: 12,
            max_inventory: 3,
            quantity: 1,
            can_purchase: true,
          }}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Use a Freeze" }));
    expect(onUseFreeze).toHaveBeenCalledOnce();
    expect(screen.getByText(/Brack checks your current local reading day/i)).toBeVisible();
  });
});
