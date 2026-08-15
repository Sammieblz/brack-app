import { describe, expect, it } from "vitest";
import type {
  GamificationAccount,
  GamificationHomeResponse,
  QuestAssignment,
} from "@/services/api/gamification";
import {
  formatQuestValue,
  formatTimeRemaining,
  getGamificationHomeExpirationDelay,
  getGamificationHomeFreshness,
  getGamificationHomePresentationData,
  getJourneyEntryTelemetrySource,
  getLevelProgressDetails,
  getQuestAction,
  selectDailyFocus,
} from "./journey";

const quest = (
  id: string,
  overrides: Partial<QuestAssignment> = {},
): QuestAssignment => ({
  id,
  title: id,
  description: id,
  cadence: "daily",
  metric: "pages_read",
  target_value: 10,
  progress_value: 0,
  reward_ink: 10,
  reward_gold_leaves: 0,
  status: "active",
  period_start: "2026-08-11T00:00:00Z",
  period_end: "2026-08-12T00:00:00Z",
  completed_at: null,
  ...overrides,
});

describe("Journey presentation rules", () => {
  it("attributes only a validated Dashboard HUD navigation state", () => {
    expect(getJourneyEntryTelemetrySource(
      { journeyTelemetrySource: "dashboard_hud" },
      true,
    )).toBe("dashboard_hud");
    expect(getJourneyEntryTelemetrySource(
      { journeyTelemetrySource: "untrusted_source" },
      true,
    )).toBe("deep_link");
    expect(getJourneyEntryTelemetrySource(null, false)).toBe("navigation");
  });

  it("selects the furthest-started daily quest before untouched quests", () => {
    const result = selectDailyFocus([
      quest("untouched"),
      quest("half", { progress_value: 5 }),
      quest("almost", { progress_value: 9 }),
    ]);

    expect(result?.id).toBe("almost");
  });

  it("uses a completed daily before falling back to a weekly quest", () => {
    const result = selectDailyFocus([
      quest("weekly", { cadence: "weekly" }),
      quest("complete", {
        status: "completed",
        completed_at: "2026-08-11T12:00:00Z",
      }),
    ]);

    expect(result?.id).toBe("complete");
  });

  it("never promotes an expired quest to Daily Focus", () => {
    const result = selectDailyFocus([
      quest("expired-daily", { status: "expired", progress_value: 9 }),
      quest("active-weekly", { cadence: "weekly", progress_value: 1 }),
    ]);

    expect(result).toBeNull();
  });

  it("uses an active weekly quest only when no daily assignment exists", () => {
    const result = selectDailyFocus([
      quest("active-weekly", { cadence: "weekly", progress_value: 1 }),
    ]);

    expect(result?.id).toBe("active-weekly");
  });

  it("maps known quest metrics to contextual actions and readable units", () => {
    expect(getQuestAction("reading_minutes")).toBe("timer");
    expect(getQuestAction("pages_read")).toBe("progress");
    expect(getQuestAction("books_completed")).toBe("library");
    expect(getQuestAction("future_metric")).toBe("library");
    expect(formatQuestValue(1, "reading_minutes")).toBe("1 minute");
    expect(formatQuestValue(24, "pages_read")).toBe("24 pages");
  });

  it("calculates within-level progress and the maximum-level state", () => {
    const account: GamificationAccount = {
      user_id: "reader",
      lifetime_ink: 175,
      gold_leaves: 0,
      current_level: 2,
      level_title: "Page Turner",
      level_threshold: 100,
      next_level: { level: 3, title: "Bookbound", ink_threshold: 300 },
      leaderboard_opt_in: true,
      leaderboard_eligible_from: null,
      gamification_profile_visible: true,
    };

    expect(getLevelProgressDetails(account)).toEqual({
      currentInk: 75,
      span: 200,
      percentage: 37.5,
      remaining: 125,
      isMaximumLevel: false,
    });
    expect(getLevelProgressDetails({ ...account, next_level: null }).isMaximumLevel).toBe(true);
  });

  it("uses server time rather than an incorrect client clock", () => {
    const receivedAt = Date.parse("2026-08-11T03:00:00Z");
    expect(formatTimeRemaining(
      "2026-08-11T13:30:00Z",
      "2026-08-11T12:00:00Z",
      receivedAt,
      receivedAt,
    )).toBe("1h 30m remaining");

    expect(formatTimeRemaining(
      "2026-08-11T13:30:00Z",
      "2026-08-11T12:00:00Z",
      receivedAt,
      receivedAt + 60_000,
    )).toBe("1h 29m remaining");
  });

  it("counts a date-only assignment through the end of its local day", () => {
    const receivedAt = Date.parse("2026-08-11T16:00:00Z");
    expect(formatTimeRemaining(
      "2026-08-11",
      "2026-08-11T16:00:00Z",
      receivedAt,
      receivedAt,
      "America/New_York",
    )).toBe("12h 0m remaining");
  });

  it("expires cached Journey data at the daily assignment boundary", () => {
    const receivedAt = Date.parse("2026-08-11T03:00:00Z");
    const home = {
      account: {
        user_id: "reader",
        lifetime_ink: 175,
        gold_leaves: 3,
        current_level: 2,
        level_title: "Page Turner",
        level_threshold: 100,
        next_level: null,
        leaderboard_opt_in: true,
        leaderboard_eligible_from: null,
        gamification_profile_visible: true,
      },
      quests: [quest("daily-boundary", { period_end: "2026-08-11T13:00:00Z" })],
      tomorrow_quests: [],
      recent_rewards: [],
      league: null,
      week: {
        id: "week",
        week_start: "2026-08-10",
        week_end: "2026-08-17",
        scoring_closes_at: "2026-08-17T00:00:00Z",
        status: "active" as const,
        finalized_at: null,
      },
      server_time: "2026-08-11T12:00:00Z",
      timezone: "UTC",
      source: "cached" as const,
      cached_at: "2026-08-11T03:00:00Z",
    };

    expect(getGamificationHomeFreshness(home, receivedAt + 30 * 60_000)).toBe("cached");
    expect(getGamificationHomeFreshness(home, receivedAt + 60 * 60_000)).toBe("expired");
    expect(getGamificationHomeFreshness({
      ...home,
      quests: [quest("invalid", { period_end: "not-a-date" })],
    }, receivedAt)).toBe("expired");
    expect(getGamificationHomeFreshness({ ...home, cached_at: null }, receivedAt)).toBe("expired");
  });

  it("does not expire an inclusive date-only daily assignment at UTC midnight", () => {
    const receivedAt = Date.parse("2026-08-11T16:00:00Z");
    const home = {
      account: {
        user_id: "reader",
        lifetime_ink: 175,
        gold_leaves: 3,
        current_level: 2,
        level_title: "Page Turner",
        level_threshold: 100,
        next_level: null,
        leaderboard_opt_in: true,
        leaderboard_eligible_from: null,
        gamification_profile_visible: true,
      },
      quests: [quest("date-only", { period_end: "2026-08-11" })],
      tomorrow_quests: [],
      recent_rewards: [],
      league: null,
      week: {
        id: "week",
        week_start: "2026-08-10",
        week_end: "2026-08-17",
        scoring_closes_at: "2026-08-17T00:00:00Z",
        status: "active" as const,
        finalized_at: null,
      },
      server_time: "2026-08-11T16:00:00Z",
      timezone: "America/New_York",
      source: "cached" as const,
      cached_at: "2026-08-11T16:00:00Z",
    };

    expect(getGamificationHomeFreshness(home, receivedAt)).toBe("cached");
    expect(getGamificationHomeFreshness(home, receivedAt + 12 * 60 * 60_000)).toBe("expired");
  });

  it("expires a live response on quest and week boundaries without another fetch", () => {
    const receivedAt = Date.parse("2026-08-11T03:00:00Z");
    const liveHome: GamificationHomeResponse = {
      account: {
        user_id: "reader",
        lifetime_ink: 175,
        gold_leaves: 3,
        current_level: 2,
        level_title: "Page Turner",
        level_threshold: 100,
        next_level: null,
        leaderboard_opt_in: true,
        leaderboard_eligible_from: null,
        gamification_profile_visible: true,
      },
      quests: [quest("daily-boundary", { period_end: "2026-08-11T13:00:00Z" })],
      tomorrow_quests: [],
      recent_rewards: [],
      league: null,
      week: {
        id: "week",
        week_start: "2026-08-10",
        week_end: "2026-08-17",
        scoring_closes_at: "2026-08-17T00:00:00Z",
        status: "active",
        finalized_at: null,
      },
      server_time: "2026-08-11T12:00:00Z",
      timezone: "UTC",
      source: "live",
      cached_at: null,
    };

    expect(getGamificationHomeExpirationDelay(liveHome, receivedAt, receivedAt))
      .toBe(60 * 60_000);
    expect(getGamificationHomeFreshness(liveHome, receivedAt + 59 * 60_000, receivedAt))
      .toBe("live");
    expect(getGamificationHomeFreshness(liveHome, receivedAt + 60 * 60_000, receivedAt))
      .toBe("expired");

    const weekOnly = {
      ...liveHome,
      quests: [],
      week: {
        ...liveHome.week,
        scoring_closes_at: "2026-08-11T12:05:00Z",
      },
    };
    expect(getGamificationHomeFreshness(weekOnly, receivedAt + 4 * 60_000, receivedAt))
      .toBe("live");
    expect(getGamificationHomeFreshness(weekOnly, receivedAt + 5 * 60_000, receivedAt))
      .toBe("expired");
  });

  it("presents hydrated live-labelled data as cached until this session confirms it", () => {
    const receivedAt = Date.parse("2026-08-11T03:00:00Z");
    const hydrated = {
      account: {
        user_id: "reader",
        lifetime_ink: 175,
        gold_leaves: 3,
        current_level: 2,
        level_title: "Page Turner",
        level_threshold: 100,
        next_level: null,
        leaderboard_opt_in: true,
        leaderboard_eligible_from: null,
        gamification_profile_visible: true,
      },
      quests: [quest("daily-boundary", { period_end: "2026-08-11T13:00:00Z" })],
      tomorrow_quests: [],
      recent_rewards: [],
      league: null,
      week: {
        id: "week",
        week_start: "2026-08-10",
        week_end: "2026-08-17",
        scoring_closes_at: "2026-08-17T00:00:00Z",
        status: "active" as const,
        finalized_at: null,
      },
      server_time: "2026-08-11T12:00:00Z",
      timezone: "UTC",
      source: "live" as const,
      cached_at: null,
    };

    const beforeFetch = getGamificationHomePresentationData(
      hydrated,
      receivedAt,
      false,
    );
    expect(beforeFetch).toMatchObject({
      source: "cached",
      cached_at: "2026-08-11T03:00:00.000Z",
    });
    expect(getGamificationHomeFreshness(beforeFetch, receivedAt)).toBe("cached");
    expect(getGamificationHomePresentationData(hydrated, receivedAt, true))
      .toBe(hydrated);
  });
});
