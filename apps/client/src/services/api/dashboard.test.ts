import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardHomeResponse } from "./dashboard";

const mocks = vi.hoisted(() => ({ invokeFunction: vi.fn() }));

vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return { ...actual, invokeFunction: mocks.invokeFunction };
});

import {
  getDashboardExperience,
  getDashboardJourneyCorrectedNow,
  isDashboardJourneySnapshotExpired,
} from "./dashboard";

const response = (): DashboardHomeResponse => ({
  continueBooks: [],
  activeGoal: null,
  today: { minutes: 0, sessionCount: 0, progressLogCount: 0 },
  streak: { currentStreak: 4, longestStreak: 8, lastReadingDate: null, freezeUsedAt: null },
  stats: {
    totalBooks: 3,
    completedBooks: 1,
    readingBooks: 1,
    toReadBooks: 1,
    pagesRead: 150,
    readingMinutes: 90,
  },
  recentActivity: [],
  achievements: [],
  journey: {
    account: {
      user_id: "reader",
      lifetime_ink: 200,
      gold_leaves: 30,
      current_level: 2,
      level_title: "Page Turner",
      level_threshold: 100,
      next_level: { level: 3, title: "Bookbound", ink_threshold: 300 },
      leaderboard_opt_in: true,
      leaderboard_eligible_from: null,
      gamification_profile_visible: true,
    },
    quests: [{
      id: "quest-1",
      title: "Read today",
      description: "Read twenty minutes",
      cadence: "daily",
      metric: "reading_minutes",
      target_value: 20,
      progress_value: 5,
      reward_ink: 20,
      reward_gold_leaves: 1,
      status: "active",
      period_start: "2099-08-11T00:00:00Z",
      period_end: "2099-08-12T00:00:00Z",
      completed_at: null,
    }],
    league: null,
    week: {
      id: "week-1",
      week_start: "2099-08-10T00:00:00Z",
      week_end: "2099-08-17T00:00:00Z",
      scoring_closes_at: "2099-08-17T00:00:00Z",
      status: "active",
      finalized_at: null,
    },
    server_time: "2099-08-11T12:00:00Z",
    timezone: "UTC",
    streak_freeze: {
      code: "streak_freeze",
      display_name: "Streak Freeze",
      description: "Protect a missed day",
      gold_leaves_cost: 10,
      max_inventory: 3,
      quantity: 1,
      can_purchase: true,
    },
    latest_milestone: null,
  },
  meta: {
    schema_version: 2,
    served_at: "2099-08-11T12:00:00Z",
    journey_status: "ok",
    inventory_status: "ok",
  },
});

describe("dashboard-home v2 client", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.invokeFunction.mockReset();
  });

  it("uses user, schema, limit, and Journey scope in the persisted cache key", async () => {
    mocks.invokeFunction.mockResolvedValue(response());
    await getDashboardExperience("reader", { includeJourney: true, recentLimit: 7 });
    expect(localStorage.getItem("brack:dashboard-home:v2:reader:7:journey")).not.toBeNull();
    expect(localStorage.getItem("brack:dashboard-home:v2:reader:7:core")).toBeNull();
  });

  it("falls back to a snapshot for server/connectivity failures", async () => {
    mocks.invokeFunction.mockResolvedValueOnce(response());
    await getDashboardExperience("reader", { includeJourney: true });
    mocks.invokeFunction.mockRejectedValueOnce({ status: 500, message: "Unavailable" });

    const cached = await getDashboardExperience("reader", { includeJourney: true });
    expect(cached.source).toBe("cached");
    expect(cached.journeyFreshness).toBe("cached");
    expect(cached.data.journey?.account.lifetime_ink).toBe(200);
  });

  it("does not hide authentication errors behind cached data", async () => {
    mocks.invokeFunction.mockResolvedValueOnce(response());
    await getDashboardExperience("reader", { includeJourney: true });
    mocks.invokeFunction.mockRejectedValueOnce({ status: 401, message: "Unauthorized" });

    await expect(getDashboardExperience("reader", { includeJourney: true }))
      .rejects.toMatchObject({ status: 401 });
  });

  it("merges a last-good Journey read-only when the live core response is partial", async () => {
    mocks.invokeFunction.mockResolvedValueOnce(response());
    const live = await getDashboardExperience("reader", { includeJourney: true });
    const partial = {
      ...response(),
      journey: null,
      meta: {
        ...response().meta!,
        journey_status: "unavailable" as const,
        inventory_status: "unavailable" as const,
      },
    };
    mocks.invokeFunction.mockResolvedValueOnce(partial);

    const merged = await getDashboardExperience("reader", { includeJourney: true });
    expect(merged.source).toBe("live");
    expect(merged.journeyFreshness).toBe("cached");
    expect(merged.cachedAt).toBe(live.cachedAt);
    expect(merged.data.journey?.account.gold_leaves).toBe(30);
    expect(merged.data.meta?.journey_status).toBe("unavailable");
  });

  it("expires cached Journey data when the daily cycle ended even if the week is active", () => {
    const journey = response().journey!;
    expect(isDashboardJourneySnapshotExpired({
      ...journey,
      quests: journey.quests.map((quest) => ({
        ...quest,
        period_end: "2026-08-11T04:00:00Z",
      })),
      week: {
        ...journey.week,
        scoring_closes_at: "2026-08-17T04:00:00Z",
      },
    }, Date.parse("2026-08-12T12:00:00Z"))).toBe(true);
  });

  it("expires next-day cache from completed daily assignments", () => {
    const journey = response().journey!;
    expect(isDashboardJourneySnapshotExpired({
      ...journey,
      quests: journey.quests.map((quest) => ({
        ...quest,
        status: "completed" as const,
        completed_at: "2026-08-11T03:00:00Z",
        period_end: "2026-08-11T04:00:00Z",
      })),
      week: {
        ...journey.week,
        scoring_closes_at: "2026-08-17T04:00:00Z",
      },
    }, Date.parse("2026-08-12T12:00:00Z"))).toBe(true);
  });

  it("expires unverifiable daily assignments instead of falling back to the week", () => {
    const journey = response().journey!;
    expect(isDashboardJourneySnapshotExpired({
      ...journey,
      quests: journey.quests.map((quest) => ({
        ...quest,
        period_end: "not-a-date",
      })),
      week: {
        ...journey.week,
        scoring_closes_at: "2026-08-17T04:00:00Z",
      },
    }, Date.parse("2026-08-12T12:00:00Z"))).toBe(true);
  });

  it("uses server time and receipt time instead of a skewed device clock", () => {
    const journey = response().journey!;
    const skewedReceipt = "2099-08-12T12:00:00Z";
    const correctedNow = getDashboardJourneyCorrectedNow(
      journey,
      skewedReceipt,
      Date.parse(skewedReceipt),
    );

    expect(correctedNow).toBe(Date.parse(journey.server_time));
    expect(isDashboardJourneySnapshotExpired(journey, correctedNow)).toBe(false);
  });

  it("keeps an inclusive date-only daily period current until local midnight", () => {
    const journey = {
      ...response().journey!,
      timezone: "America/New_York",
      quests: response().journey!.quests.map((item) => ({
        ...item,
        period_end: "2026-08-11",
      })),
    };

    expect(isDashboardJourneySnapshotExpired(
      journey,
      Date.parse("2026-08-11T16:00:00Z"),
    )).toBe(false);
    expect(isDashboardJourneySnapshotExpired(
      journey,
      Date.parse("2026-08-12T04:00:00Z"),
    )).toBe(true);
  });
});
