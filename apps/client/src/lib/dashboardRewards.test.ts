import { describe, expect, it } from "vitest";
import {
  observeDashboardRewards,
  summarizeDashboardRewards,
  type DashboardRewardDelta,
} from "./dashboardRewards";

const reward = (id: string): DashboardRewardDelta => ({
  id,
  ink_delta: 10,
  gold_leaves_delta: 1,
});

describe("Dashboard reward observation", () => {
  const window = [reward("newest"), reward("middle"), reward("oldest")];

  it("initializes without replaying a cold-load reward window", () => {
    expect(observeDashboardRewards(window, null)).toEqual({
      newestId: "newest",
      confirmed: [],
      initializesCursor: true,
    });
  });

  it("returns adjacent and multiple new rewards", () => {
    expect(observeDashboardRewards(window, "middle").confirmed.map(({ id }) => id))
      .toEqual(["newest"]);
    expect(observeDashboardRewards(window, "oldest").confirmed.map(({ id }) => id))
      .toEqual(["newest", "middle"]);
  });

  it("aggregates the available window when the prior cursor fell outside it", () => {
    expect(observeDashboardRewards(window, "outside-window").confirmed.map(({ id }) => id))
      .toEqual(["newest", "middle", "oldest"]);
  });

  it("does not replay the newest observed reward", () => {
    expect(observeDashboardRewards(window, "newest").confirmed).toEqual([]);
  });

  it("recognizes the first earning after this session observed an empty window", () => {
    expect(observeDashboardRewards([reward("first")], null, { hasObservedWindow: true }))
      .toEqual({
        newestId: "first",
        confirmed: [reward("first")],
        initializesCursor: false,
      });
  });

  it("excludes shop debits and zero-value ledger rows from reward feedback", () => {
    const debitsAndReward: DashboardRewardDelta[] = [
      { id: "purchase", ink_delta: 0, gold_leaves_delta: -10 },
      { id: "neutral", ink_delta: 0, gold_leaves_delta: 0 },
      reward("earned"),
      reward("seen"),
    ];

    expect(observeDashboardRewards(debitsAndReward, "seen").confirmed).toEqual([
      reward("earned"),
    ]);
    expect(observeDashboardRewards(debitsAndReward.slice(0, 2), "seen")).toEqual({
      newestId: null,
      confirmed: [],
      initializesCursor: false,
    });
  });

  it("aggregates positive currency only and never includes debits", () => {
    expect(summarizeDashboardRewards([
      { id: "ink", ink_delta: 12, gold_leaves_delta: 0 },
      { id: "mixed", ink_delta: -5, gold_leaves_delta: 2 },
      { id: "purchase", ink_delta: 0, gold_leaves_delta: -10 },
      { id: "neutral", ink_delta: 0, gold_leaves_delta: 0 },
    ])).toEqual({ rewardCount: 2, ink: 12, goldLeaves: 2 });
  });

  it("ignores malformed non-finite reward amounts", () => {
    expect(summarizeDashboardRewards([
      { id: "malformed", ink_delta: Number.NaN, gold_leaves_delta: Number.POSITIVE_INFINITY },
    ])).toEqual({ rewardCount: 0, ink: 0, goldLeaves: 0 });
  });
});
