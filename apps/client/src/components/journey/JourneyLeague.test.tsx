import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JourneyLeague, LeaderboardTable } from "./JourneyLeague";
import type { LeaderboardEntry } from "@/services/api/gamification";

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({ triggerHaptic: vi.fn() }),
}));

const entry = (rank: number): LeaderboardEntry => ({
  user_id: `reader-${rank}`,
  rank,
  competitive_ink: 500 - rank,
  quests_completed: 3,
  qualifying_minutes: 90,
  reading_days: 5,
  display_name: `Reader ${rank}`,
  avatar_url: null,
  level: 2,
  level_title: "Page Turner",
  is_current_user: rank === 2,
});

describe("Journey League standings", () => {
  afterEach(cleanup);

  it("uses a wide podium and hides duplicate top-three compact rows at that width", () => {
    render(
      <LeaderboardTable
        loading={false}
        refreshing={false}
        cached={false}
        error={null}
        entries={[entry(1), entry(2), entry(3), entry(4)]}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("list", { name: "Reader League podium" })).toHaveClass(
      "journey-league-podium",
    );
    expect(screen.getByTestId("league-row-1")).toHaveClass("journey-league-top-entry");
    expect(screen.getByTestId("league-row-3")).toHaveClass("journey-league-top-entry");
    expect(screen.getByTestId("league-row-4")).not.toHaveClass("journey-league-top-entry");
  });

  it("uses a labelled native scope picker on mobile and keeps desktop scope tabs", () => {
    const onScopeChange = vi.fn();
    const props: ComponentProps<typeof JourneyLeague> = {
      enabled: true,
      account: {
        user_id: "reader", lifetime_ink: 20, gold_leaves: 5, current_level: 1,
        level_title: "Fresh Ink", level_threshold: 0, next_level: null,
        leaderboard_opt_in: true, leaderboard_eligible_from: null, gamification_profile_visible: true,
      },
      league: null,
      cutoff: "2026-09-13T00:00:00Z", serverTime: "2026-09-10T00:00:00Z",
      scope: "league", mobile: true, savingOptIn: false, loading: false,
      refreshing: false, cached: false, error: null, entries: [],
      onScopeChange, onOptInChange: vi.fn(), onRetry: vi.fn(),
    };
    const { rerender } = render(<JourneyLeague {...props} />);
    const picker = screen.getByRole("combobox", { name: "Ranking group" });
    expect(picker.tagName).toBe("SELECT");
    expect(screen.getAllByRole("option").map((option) => option.textContent))
      .toEqual(["My league", "Friends", "Global top 100"]);
    fireEvent.change(picker, { target: { value: "friends" } });
    expect(onScopeChange).toHaveBeenCalledWith("friends");
    rerender(<JourneyLeague {...props} scope="friends" />);
    expect(picker).toHaveValue("friends");

    rerender(<JourneyLeague {...props} mobile={false} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "My league" })).toHaveAttribute("data-state", "active");
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });
});
