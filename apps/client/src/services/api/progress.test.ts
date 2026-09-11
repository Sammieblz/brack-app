import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: fromMock } }));

import { buildProgressTimeline, fetchProgressTrackingData, updateBookStatusForActivity } from "./progress";

const localJuly = (day: number, hour = 12, minute = 0) => new Date(2026, 6, day, hour, minute).toISOString();

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("progress timeline", () => {
  it("carries the page baseline through session-only days", () => {
    const { dailyProgress, velocityData } = buildProgressTimeline(
      [
        {
          logged_at: localJuly(1),
          page_number: 100,
          time_spent_minutes: null,
        },
        {
          logged_at: localJuly(3),
          page_number: 120,
          time_spent_minutes: null,
        },
      ],
      [
        {
          start_time: localJuly(2, 20),
          created_at: localJuly(4, 9),
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
          logged_at: localJuly(1),
          page_number: 100,
          time_spent_minutes: 60,
        },
        {
          logged_at: localJuly(2),
          page_number: 80,
          time_spent_minutes: 30,
        },
        {
          logged_at: localJuly(3),
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
          logged_at: localJuly(1),
          page_number: 100,
          time_spent_minutes: null,
        },
        {
          logged_at: localJuly(10),
          page_number: 121,
          time_spent_minutes: null,
        },
      ],
      [],
    );

    expect(velocityData[1].pages_per_day).toBe(3);
  });

  it("groups real timestamps by the local reading day on either side of midnight", () => {
    const logs = [{ logged_at: localJuly(1, 23, 50), page_number: 20, time_spent_minutes: 10 }];
    const sessions = [{ start_time: localJuly(2, 0, 15), duration: 15 }];
    const originalTimestamp = logs[0].logged_at;
    expect(buildProgressTimeline(logs, sessions).dailyProgress).toEqual([
      { date: "2026-07-01", pages_read: 20, time_spent: 10 },
      { date: "2026-07-02", pages_read: 0, time_spent: 15 },
    ]);
    expect(logs[0].logged_at).toBe(originalTimestamp);
  });

  it("ignores unreadable event timestamps instead of inventing a day", () => {
    expect(buildProgressTimeline([
      { logged_at: "invalid", page_number: 5, time_spent_minutes: 10 },
    ], [{ start_time: "invalid", duration: 10 }]).dailyProgress).toEqual([]);
  });
});

describe("automatic progress dates", () => {
  it("sends a calendar date when activity starts a queued book", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 11, 31, 23, 50));
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    fromMock.mockImplementation((table: string) => ({
      update,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { status: "to_read" }, error: null }),
          limit: vi.fn().mockResolvedValue({ data: table === "progress_logs" ? [{ id: "log-1" }] : [] }),
          is: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [] }) }),
        }),
      }),
    }));

    await updateBookStatusForActivity("book-1");

    expect(update).toHaveBeenCalledExactlyOnceWith({ status: "reading", date_started: "2026-12-31" });
  });

  it("starts completion forecasts on the next local day across New Year", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 11, 31, 23, 50));
    fromMock.mockImplementation((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { pages: 100, current_page: 20 }, error: null }),
          order: vi.fn().mockResolvedValue({
            data: table === "progress_logs"
              ? [{ logged_at: new Date(2026, 11, 31, 23, 0).toISOString(), page_number: 20, time_spent_minutes: 10 }]
              : [],
            error: null,
          }),
        }),
      }),
    }));

    const result = await fetchProgressTrackingData("book-1");

    expect(result.forecastData.slice(0, 2)).toEqual([
      { date: "2026-12-31", predicted_page: 20, actual_page: 20 },
      { date: "2027-01-01", predicted_page: 40 },
    ]);
  });
});
