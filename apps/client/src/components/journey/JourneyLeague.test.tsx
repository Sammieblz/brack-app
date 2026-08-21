import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeaderboardTable } from "./JourneyLeague";
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
});
