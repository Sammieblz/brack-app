import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GamificationAccount, QuestAssignment } from "@/services/api/gamification";
import { ReaderHud } from "./ReaderHud";
import { DailyFocusCard } from "./DailyFocusCard";

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({ triggerHaptic: vi.fn() }),
}));

const account: GamificationAccount = {
  user_id: "reader",
  lifetime_ink: 200,
  gold_leaves: 45,
  current_level: 2,
  level_title: "Page Turner",
  level_threshold: 100,
  next_level: { level: 3, title: "Bookbound", ink_threshold: 300 },
  leaderboard_opt_in: true,
  leaderboard_eligible_from: null,
  gamification_profile_visible: true,
};

const quest: QuestAssignment = {
  id: "daily-1",
  title: "Twenty-minute chapter",
  description: "Read for twenty focused minutes.",
  cadence: "daily",
  metric: "reading_minutes",
  target_value: 20,
  progress_value: 10,
  reward_ink: 30,
  reward_gold_leaves: 2,
  status: "active",
  period_start: "2026-08-11T04:00:00Z",
  period_end: "2026-08-12T04:00:00Z",
  completed_at: null,
};

const LocationStateProbe = () => {
  const location = useLocation();
  return <output data-testid="location-state">{JSON.stringify(location.state)}</output>;
};

afterEach(cleanup);

describe("ReaderHud", () => {
  it("keeps all three resources independently named and linked", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReaderHud
          account={account}
          currentStreak={7}
          freeze={{ quantity: 2, max_inventory: 3 }}
        />
        <LocationStateProbe />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /level 2, page turner.*100 ink to level 3/i }))
      .toHaveAttribute("href", "/achievements?tab=overview");
    expect(screen.getByText("200 Ink")).toBeVisible();
    expect(screen.getByText("100 Ink to Level 3")).toBeVisible();
    expect(screen.getByRole("link", { name: /7 day reading streak.*2 streak freezes/i }))
      .toHaveAttribute("href", "/achievements?tab=quests");
    const wallet = screen.getByRole("link", { name: /45 gold leaves.*journey shop/i });
    expect(wallet).toHaveAttribute("href", "/achievements?tab=shop");
    expect(document.querySelector('[data-reward-hud-target="ink"]'))
      .toContainElement(document.querySelector('[data-reward-hud-value="ink"]'));
    expect(document.querySelector('[data-reward-hud-target="goldLeaves"]'))
      .toContainElement(document.querySelector('[data-reward-hud-value="goldLeaves"]'));

    await user.click(wallet);
    expect(screen.getByTestId("location-state")).toHaveTextContent(
      JSON.stringify({ journeyTelemetrySource: "dashboard_hud" }),
    );
  });

  it("announces maximum level and renders an accessible progressbar", () => {
    render(
      <MemoryRouter>
        <ReaderHud account={{ ...account, next_level: null }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /maximum level/i })).toBeInTheDocument();
    expect(screen.getByText("Maximum level")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: /level progress 100 percent/i }))
      .toHaveAttribute("data-variant", "default");
  });

  it("renders cache status in a dedicated footer instead of over wallet content", () => {
    render(
      <MemoryRouter>
        <ReaderHud
          account={account}
          freshness="cached"
          cachedAt="2026-08-11T10:00:00Z"
        />
      </MemoryRouter>,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveClass("col-span-3");
    expect(status).toHaveTextContent(/synced/i);
  });

  it("shows missing freeze inventory as unavailable instead of inventing a zero balance", () => {
    render(
      <MemoryRouter>
        <ReaderHud account={account} currentStreak={4} freeze={null} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", {
      name: /4 day reading streak.*streak freeze inventory unavailable/i,
    })).toBeInTheDocument();
    expect(screen.getByText("Inventory unavailable")).toBeVisible();
    expect(screen.queryByText("0 protected")).not.toBeInTheDocument();
  });

  it("keeps a cached, known freeze quantity visible", () => {
    render(
      <MemoryRouter>
        <ReaderHud
          account={account}
          currentStreak={4}
          freeze={{ quantity: 1, max_inventory: 3 }}
          freshness="cached"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", {
      name: /4 day reading streak.*1 streak freeze owned/i,
    })).toBeInTheDocument();
    expect(screen.getByText("1 protected")).toBeVisible();
  });

  it("keeps very large wallet balances truncatable at phone widths", () => {
    const balance = 9_999_999_999;
    render(
      <MemoryRouter>
        <ReaderHud account={{ ...account, gold_leaves: balance }} />
      </MemoryRouter>,
    );

    const visibleBalance = screen.getByText(balance.toLocaleString());
    expect(visibleBalance).toHaveClass("truncate", "max-[359px]:text-xs");
    expect(visibleBalance).toHaveAttribute("title", balance.toLocaleString());
    expect(screen.getByRole("link", { name: /9,999,999,999 Gold Leaves/i }))
      .toBeInTheDocument();
  });

  it("offers a compact retry state without exposing stale controls", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    render(<ReaderHud error="Offline" onRetry={retry} />);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe("DailyFocusCard", () => {
  it("shows unit-aware progress, both rewards, and the contextual CTA", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DailyFocusCard
          quest={quest}
          serverTime="2026-08-11T14:00:00Z"
          hasCurrentBook
          onAction={onAction}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Twenty-minute chapter" })).toBeInTheDocument();
    expect(screen.getByText(/10 minutes/)).toBeInTheDocument();
    expect(screen.getByLabelText("30 Ink reward")).toBeInTheDocument();
    expect(screen.getByLabelText("2 Gold Leaves reward")).toBeInTheDocument();
    const progressbar = screen.getByRole("progressbar", { name: /twenty-minute chapter progress/i });
    expect(progressbar).toHaveAttribute("aria-valuenow", "10");
    expect(progressbar).toHaveAttribute("aria-valuemax", "20");
    expect(progressbar).toHaveAttribute("data-variant", "dimensional");

    await user.click(screen.getByRole("button", { name: "Start reading" }));
    expect(onAction).toHaveBeenCalledWith("timer", quest);
  });

  it("disables quest starts for an expired cached period", () => {
    render(
      <MemoryRouter>
        <DailyFocusCard quest={quest} freshness="expired" onAction={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Reconnect to start" })).toBeDisabled();
  });
});
