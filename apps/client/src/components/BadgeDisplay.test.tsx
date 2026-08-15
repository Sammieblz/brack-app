import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BadgeDisplay } from "./BadgeDisplay";
import type { Badge, UserBadge } from "@/types";

vi.mock("@/components/BadgeEmblem", () => ({
  BadgeEmblem: ({ badge }: { badge: Badge }) => <span aria-hidden="true">{badge.code}</span>,
}));

const makeBadge = (index: number): Badge => ({
  id: `badge-${index}`,
  code: `badge-${index}`,
  title: `Milestone ${index}`,
  description: `Read toward milestone ${index}`,
  icon_url: null,
  icon_key: "book",
  category: index % 2 === 0 ? "pages" : "time",
  tier: 1,
  rarity: index % 2 === 0 ? "rare" : "common",
  metric_key: "pages_read",
  target_value: 100,
  event_types: [],
  sort_order: index,
  is_active: true,
  is_secret: false,
  progress_value: index,
  progress_percentage: index,
  earned_at: null,
  created_at: "2026-08-11T00:00:00Z",
});

const earned: UserBadge = {
  id: "earned-1",
  user_id: "reader-1",
  badge_id: "badge-0",
  earned_at: "2026-08-11T12:00:00Z",
};

describe("BadgeDisplay catalog", () => {
  afterEach(cleanup);

  it("defaults to in-progress badges and reveals twelve at a time", async () => {
    const user = userEvent.setup();
    const badges = Array.from({ length: 16 }, (_, index) => makeBadge(index));
    render(
      <BadgeDisplay
        badges={badges}
        earnedBadges={[earned]}
        onBadgeClick={vi.fn()}
        catalog
      />,
    );

    expect(screen.getByRole("button", { name: "In progress 15" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: /% complete$/ })).toHaveLength(12);

    await user.click(screen.getByRole("button", { name: "Show 3 more" }));
    expect(screen.getAllByRole("button", { name: /% complete$/ })).toHaveLength(15);
  });

  it("switches to earned milestones with explicit state text", async () => {
    const user = userEvent.setup();
    render(
      <BadgeDisplay
        badges={[makeBadge(0), makeBadge(1)]}
        earnedBadges={[earned]}
        onBadgeClick={vi.fn()}
        catalog
      />,
    );

    await user.click(screen.getByRole("button", { name: "Earned 1" }));

    expect(screen.getByRole("button", { name: "Milestone 0, earned" })).toBeInTheDocument();
    expect(screen.getByText("Earned")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Milestone 1, .*complete/ })).not.toBeInTheDocument();
  });
});

