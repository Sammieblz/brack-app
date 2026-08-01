import { describe, expect, it } from "vitest";
import {
  calculateInkLevelProgress,
  compareLeaderboardEntries,
  questProgressPercent,
} from "./gamification";
import type {
  GamificationAccount,
  LeaderboardEntry,
} from "@/services/api/gamification";

const account = (lifetimeInk: number): GamificationAccount => ({
  user_id: "reader",
  lifetime_ink: lifetimeInk,
  gold_leaves: 0,
  current_level: 2,
  level_title: "Page Turner",
  level_threshold: 100,
  next_level: { level: 3, title: "Bookbound", ink_threshold: 300 },
  leaderboard_opt_in: false,
  leaderboard_eligible_from: null,
  gamification_profile_visible: true,
});

describe("gamification presentation rules", () => {
  it("calculates bounded progress between level thresholds", () => {
    expect(calculateInkLevelProgress(account(200))).toBe(50);
    expect(calculateInkLevelProgress(account(50))).toBe(0);
    expect(calculateInkLevelProgress(account(400))).toBe(100);
  });

  it("shows full progress at the highest configured level", () => {
    expect(calculateInkLevelProgress({ ...account(300), next_level: null })).toBe(100);
  });

  it("orders ties by quests, minutes, then distinct reading days", () => {
    const base: LeaderboardEntry = {
      user_id: "one",
      rank: 1,
      competitive_ink: 100,
      quests_completed: 2,
      qualifying_minutes: 60,
      reading_days: 3,
      display_name: "One",
      avatar_url: null,
      level: 2,
      level_title: "Page Turner",
      is_current_user: false,
    };
    expect(compareLeaderboardEntries(
      { ...base, user_id: "one", quests_completed: 3 },
      { ...base, user_id: "two", quests_completed: 2 },
    )).toBeLessThan(0);
    expect(compareLeaderboardEntries(
      { ...base, user_id: "one", qualifying_minutes: 90 },
      { ...base, user_id: "two", qualifying_minutes: 60 },
    )).toBeLessThan(0);
    expect(compareLeaderboardEntries(
      { ...base, user_id: "one", reading_days: 5 },
      { ...base, user_id: "two", reading_days: 3 },
    )).toBeLessThan(0);
  });

  it("bounds quest progress", () => {
    expect(questProgressPercent(5, 10)).toBe(50);
    expect(questProgressPercent(20, 10)).toBe(100);
    expect(questProgressPercent(-1, 10)).toBe(0);
  });
});
