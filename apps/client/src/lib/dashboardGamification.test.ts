import { describe, expect, it } from "vitest";
import type { Goal } from "@/types";
import type { QuestAssignment } from "@/services/api/gamification";
import {
  formatQuestCountdown,
  getGoalProgressDetails,
  getLevelProgressDetails,
  getQuestAction,
  getQuestRemainingMs,
  getRecentActivityInsight,
  selectDailyFocusQuest,
} from "./dashboardGamification";

const quest = (overrides: Partial<QuestAssignment> = {}): QuestAssignment => ({
  id: "quest-1",
  title: "Read with focus",
  description: "Read for twenty minutes",
  cadence: "daily",
  metric: "reading_minutes",
  target_value: 20,
  progress_value: 0,
  reward_ink: 25,
  reward_gold_leaves: 1,
  status: "active",
  period_start: "2026-08-11T04:00:00.000Z",
  period_end: "2026-08-12T04:00:00.000Z",
  completed_at: null,
  ...overrides,
});

describe("Dashboard gamification presentation", () => {
  it("calculates progress inside the current level rather than against lifetime Ink", () => {
    expect(getLevelProgressDetails({
      user_id: "reader",
      lifetime_ink: 200,
      gold_leaves: 10,
      current_level: 2,
      level_title: "Page Turner",
      level_threshold: 100,
      next_level: { level: 3, title: "Bookbound", ink_threshold: 300 },
      leaderboard_opt_in: true,
      leaderboard_eligible_from: null,
      gamification_profile_visible: true,
    })).toMatchObject({
      percent: 50,
      earnedInLevel: 100,
      levelSpan: 200,
      inkToNextLevel: 100,
      isMaximumLevel: false,
    });
  });

  it("uses a complete maximum-level state", () => {
    const details = getLevelProgressDetails({
      user_id: "reader",
      lifetime_ink: 900,
      gold_leaves: 0,
      current_level: 9,
      level_title: "First Edition",
      level_threshold: 800,
      next_level: null,
      leaderboard_opt_in: true,
      leaderboard_eligible_from: null,
      gamification_profile_visible: true,
    });
    expect(details.percent).toBe(100);
    expect(details.isMaximumLevel).toBe(true);
  });

  it("selects the most advanced started daily quest deterministically", () => {
    const selected = selectDailyFocusQuest([
      quest({ id: "unstarted", progress_value: 0, period_end: "2026-08-11T20:00:00Z" }),
      quest({ id: "half", progress_value: 10 }),
      quest({ id: "almost", progress_value: 19 }),
      quest({ id: "weekly", cadence: "weekly", progress_value: 20 }),
    ]);
    expect(selected?.id).toBe("almost");
  });

  it("falls back from completed daily quests to active weekly quests only when needed", () => {
    expect(selectDailyFocusQuest([
      quest({ id: "older", status: "completed", completed_at: "2026-08-10T10:00:00Z" }),
      quest({ id: "newer", status: "completed", completed_at: "2026-08-11T10:00:00Z" }),
      quest({ id: "weekly", cadence: "weekly" }),
    ])?.id).toBe("newer");

    expect(selectDailyFocusQuest([
      quest({ id: "expired", status: "expired" }),
      quest({ id: "weekly", cadence: "weekly" }),
    ])).toBeNull();

    expect(selectDailyFocusQuest([
      quest({ id: "weekly", cadence: "weekly" }),
    ])?.id).toBe("weekly");
  });

  it("maps quest metrics to useful actions", () => {
    expect(getQuestAction("reading_minutes")).toBe("timer");
    expect(getQuestAction("pages_read")).toBe("progress");
    expect(getQuestAction("books_completed")).toBe("library");
    expect(getQuestAction("future_metric")).toBe("library");
  });

  it("corrects countdowns using server time instead of the client clock", () => {
    const receivedAt = Date.parse("2026-08-11T12:00:00Z");
    const remaining = getQuestRemainingMs(
      "2026-08-11T14:00:00Z",
      "2026-08-11T13:00:00Z",
      receivedAt,
      receivedAt + 30 * 60_000,
    );
    expect(remaining).toBe(30 * 60_000);
    expect(formatQuestCountdown(remaining)).toBe("30m left");
  });

  it("counts date-only quest periods through local midnight", () => {
    const receivedAt = Date.parse("2026-08-11T16:00:00Z");
    expect(getQuestRemainingMs(
      "2026-08-11",
      "2026-08-11T16:00:00Z",
      receivedAt,
      receivedAt,
      "America/New_York",
    )).toBe(12 * 60 * 60_000);
  });

  it("calculates goal progress for the configured goal type", () => {
    const goal = {
      goal_type: "pages_count",
      target_pages: 1_000,
    } as Goal;
    expect(getGoalProgressDetails(goal, {
      totalBooks: 10,
      completedBooks: 4,
      readingBooks: 2,
      toReadBooks: 4,
      pagesRead: 250,
      readingMinutes: 500,
    })).toMatchObject({ current: 250, target: 1_000, percent: 25, unit: "pages" });
  });

  it("labels the capped recent feed as a sample and does not imply a weekly aggregate", () => {
    expect(getRecentActivityInsight([
      {
        id: "old-session",
        type: "reading_session",
        timestamp: "2025-01-01T12:00:00Z",
        details: { duration: 25 },
      },
      {
        id: "progress",
        type: "progress_logged",
        timestamp: "2026-08-11T12:00:00Z",
        details: { duration: 999 },
      },
      {
        id: "bad-session",
        type: "reading_session",
        timestamp: "2026-08-11T13:00:00Z",
        details: { duration: -5 },
      },
    ])).toEqual({ activityCount: 3, sessionMinutes: 25 });
  });
});
