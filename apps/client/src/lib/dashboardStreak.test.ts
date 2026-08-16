import { describe, expect, it } from "vitest";
import { getDashboardStreakPresentation } from "./dashboardStreak";

const baseStreak = {
  currentStreak: 6,
  longestStreak: 12,
  lastReadingDate: "2026-08-16",
  freezeUsedAt: null,
};

const options = {
  timezone: "America/New_York",
  serverTime: "2026-08-16T16:00:00.000Z",
  receivedAt: "2026-08-16T16:00:00.000Z",
  nowMs: Date.parse("2026-08-16T16:00:00.000Z"),
};

describe("getDashboardStreakPresentation", () => {
  it("uses the happy on-track state after reading on the user's local day", () => {
    expect(getDashboardStreakPresentation(baseStreak, options)).toMatchObject({
      state: "on_track",
      currentStreak: 6,
      readToday: true,
      protectedToday: false,
      nextMilestone: 7,
      daysToNextMilestone: 1,
    });
  });

  it("uses the protected state when a Freeze covers the local day", () => {
    const result = getDashboardStreakPresentation({
      ...baseStreak,
      lastReadingDate: "2026-08-15",
      freezeUsedAt: "2026-08-16T04:30:00.000Z",
    }, options);

    expect(result).toMatchObject({
      state: "protected",
      protectedToday: true,
      canProtectToday: false,
    });
  });

  it("marks yesterday's active streak at risk without claiming Freeze eligibility", () => {
    const result = getDashboardStreakPresentation({
      ...baseStreak,
      lastReadingDate: "2026-08-15",
    }, options);

    expect(result).toMatchObject({
      state: "at_risk",
      currentStreak: 6,
      canProtectToday: true,
    });
  });

  it("does not display an event-stale profile streak after a missed day", () => {
    const result = getDashboardStreakPresentation({
      ...baseStreak,
      currentStreak: 24,
      longestStreak: 24,
      lastReadingDate: "2026-08-12",
    }, options);

    expect(result).toMatchObject({
      state: "lapsed",
      currentStreak: 0,
      nextMilestone: 3,
    });
  });

  it("corrects the client clock from server receipt time across local midnight", () => {
    const result = getDashboardStreakPresentation(baseStreak, {
      ...options,
      serverTime: "2026-08-16T23:55:00.000Z",
      receivedAt: "2026-08-16T23:55:00.000Z",
      nowMs: Date.parse("2026-08-17T04:05:00.000Z"),
    });

    expect(result.todayKey).toBe("2026-08-17");
    expect(result.state).toBe("at_risk");
  });
});
