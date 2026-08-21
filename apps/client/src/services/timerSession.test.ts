import { describe, expect, it } from "vitest";
import {
  MAX_READING_SESSION_MINUTES,
  clampSessionMinutes,
  getSessionEndFromDuration,
  normalizePersistedTimerRecovery,
  normalizePersistedTimerState,
} from "./timerSession";

describe("timer session safeguards", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  it("restores a recent running timer with elapsed time", () => {
    const restored = normalizePersistedTimerState(
      {
        isVisible: true,
        isRunning: true,
        startTime: "2026-07-20T11:55:00.000Z",
        runningSince: "2026-07-20T11:55:00.000Z",
        accumulatedSeconds: 0,
        bookId: "book-1",
        bookTitle: "A Book",
      },
      now,
    );

    expect(restored.kind).toBe("active");
    if (restored.kind === "active") {
      expect(restored.state.time).toBe(300);
      expect(restored.state.isRunning).toBe(true);
    }
  });

  it("moves a multi-week legacy timer into stale recovery", () => {
    const restored = normalizePersistedTimerState(
      {
        isVisible: true,
        isRunning: true,
        startTime: "2026-06-29T12:00:00.000Z",
        time: 0,
        bookId: "book-1",
        bookTitle: "A Book",
      },
      now,
    );

    expect(restored.kind).toBe("stale");
    if (restored.kind === "stale") {
      expect(restored.recovery.suggestedMinutes).toBe(MAX_READING_SESSION_MINUTES);
      expect(restored.recovery.elapsedSeconds).toBeGreaterThan(20 * 24 * 60 * 60);
    }
  });

  it("does not count paused time after reload", () => {
    const restored = normalizePersistedTimerState(
      {
        isVisible: true,
        isRunning: false,
        startTime: "2026-07-20T10:00:00.000Z",
        accumulatedSeconds: 15 * 60,
        time: 15 * 60,
        bookId: "book-1",
      },
      now,
    );

    expect(restored.kind).toBe("active");
    if (restored.kind === "active") {
      expect(restored.state.time).toBe(15 * 60);
    }
  });

  it("caps manually reviewed stale duration to the maximum session length", () => {
    expect(clampSessionMinutes(99999)).toBe(MAX_READING_SESSION_MINUTES);
    expect(clampSessionMinutes(-10)).toBe(1);
  });

  it("derives a sane end time from a reviewed duration", () => {
    const start = new Date("2026-07-20T09:00:00.000Z");
    expect(getSessionEndFromDuration(start, 45).toISOString()).toBe(
      "2026-07-20T09:45:00.000Z",
    );
  });

  it("rehydrates a persisted stale-timer recovery snapshot", () => {
    const recovery = normalizePersistedTimerRecovery({
      reason: "duration_limit",
      bookId: "book-1",
      bookTitle: "A Book",
      clientSessionId: "session-1",
      startTime: "2026-07-01T09:00:00.000Z",
      elapsedSeconds: 18 * 60 * 60,
      suggestedMinutes: 90,
    });

    expect(recovery).toMatchObject({
      reason: "duration_limit",
      bookId: "book-1",
      clientSessionId: "session-1",
      elapsedSeconds: 18 * 60 * 60,
      suggestedMinutes: 90,
    });
    expect(recovery?.startTime.toISOString()).toBe("2026-07-01T09:00:00.000Z");
  });
});
