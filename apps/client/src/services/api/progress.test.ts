import { describe, expect, it } from "vitest";
import { buildProgressTimeline } from "./progress";

describe("progress timeline", () => {
  it("carries the page baseline through session-only days", () => {
    const { dailyProgress, velocityData } = buildProgressTimeline(
      [
        {
          logged_at: "2026-07-01T12:00:00.000Z",
          page_number: 100,
          time_spent_minutes: null,
        },
        {
          logged_at: "2026-07-03T12:00:00.000Z",
          page_number: 120,
          time_spent_minutes: null,
        },
      ],
      [
        {
          start_time: "2026-07-02T20:00:00.000Z",
          created_at: "2026-07-04T09:00:00.000Z",
          duration: 30,
        },
      ],
    );

    expect(dailyProgress).toEqual([
      { date: "2026-07-01", pages_read: 100, time_spent: 0 },
      { date: "2026-07-02", pages_read: 0, time_spent: 30 },
      { date: "2026-07-03", pages_read: 20, time_spent: 0 },
    ]);
    expect(dailyProgress.reduce((sum, day) => sum + day.pages_read, 0)).toBe(120);
    expect(velocityData.map((day) => day.cumulative_pages)).toEqual([100, 100, 120]);
    expect(velocityData.map((day) => day.pages_per_day)).toEqual([100, 50, 40]);
  });

  it("does not lower the cumulative baseline after a page correction", () => {
    const { dailyProgress, velocityData } = buildProgressTimeline(
      [
        {
          logged_at: "2026-07-01T12:00:00.000Z",
          page_number: 100,
          time_spent_minutes: 60,
        },
        {
          logged_at: "2026-07-02T12:00:00.000Z",
          page_number: 80,
          time_spent_minutes: 30,
        },
        {
          logged_at: "2026-07-03T12:00:00.000Z",
          page_number: 120,
          time_spent_minutes: 60,
        },
      ],
      [],
    );

    expect(dailyProgress.map((day) => day.pages_read)).toEqual([100, 0, 20]);
    expect(velocityData.map((day) => day.cumulative_pages)).toEqual([100, 100, 120]);
    expect(velocityData.map((day) => day.pagesPerHour)).toEqual([100, 0, 20]);
  });

  it("uses calendar days for the seven-day reading velocity", () => {
    const { velocityData } = buildProgressTimeline(
      [
        {
          logged_at: "2026-07-01T12:00:00.000Z",
          page_number: 100,
          time_spent_minutes: null,
        },
        {
          logged_at: "2026-07-10T12:00:00.000Z",
          page_number: 121,
          time_spent_minutes: null,
        },
      ],
      [],
    );

    expect(velocityData[1].pages_per_day).toBe(3);
  });
});
