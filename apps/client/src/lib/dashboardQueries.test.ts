import { describe, expect, it } from "vitest";
import {
  DASHBOARD_FORCE_REFRESH_INTERVAL_MS,
  claimDashboardHomeForceRefresh,
  getDashboardFetchObservation,
  isDashboardEconomyMutationReady,
  recordDashboardFetchObservation,
} from "./dashboardQueries";

describe("dashboard forced-refresh gate", () => {
  it("allows a reader's first request even when the clock starts at zero", () => {
    expect(claimDashboardHomeForceRefresh("zero-clock-reader", 0)).toEqual({
      allowed: true,
      retryAfterMs: 0,
    });
  });

  it("allows at most 12 forced requests per minute for one reader", () => {
    const userId = "throttle-reader";
    const firstAt = 100_000;

    expect(claimDashboardHomeForceRefresh(userId, firstAt)).toEqual({
      allowed: true,
      retryAfterMs: 0,
    });
    expect(claimDashboardHomeForceRefresh(userId, firstAt + 1_000)).toEqual({
      allowed: false,
      retryAfterMs: DASHBOARD_FORCE_REFRESH_INTERVAL_MS - 1_000,
    });
    expect(claimDashboardHomeForceRefresh(
      userId,
      firstAt + DASHBOARD_FORCE_REFRESH_INTERVAL_MS,
    )).toEqual({
      allowed: true,
      retryAfterMs: 0,
    });
  });
});

describe("dashboard economy mutation readiness", () => {
  const liveState = {
    hasCurrentSessionLiveResponse: true,
    hasQueryError: false,
    source: "live" as const,
    journeyFreshness: "live" as const,
    inventoryStatus: "ok" as const,
  };

  it("keeps rehydrated live-labelled data read-only until this mount receives a live response", () => {
    const userId = "rehydrated-economy-reader";
    const mountGeneration = getDashboardFetchObservation(userId).generation;

    expect(isDashboardEconomyMutationReady({
      ...liveState,
      hasCurrentSessionLiveResponse:
        getDashboardFetchObservation(userId).generation > mountGeneration,
    })).toBe(false);

    recordDashboardFetchObservation(userId, "live");
    const current = getDashboardFetchObservation(userId);
    expect(isDashboardEconomyMutationReady({
      ...liveState,
      hasCurrentSessionLiveResponse:
        current.generation > mountGeneration && current.source === "live",
    })).toBe(true);
  });

  it("allows mutations only after a current-session live response with fresh inventory", () => {
    expect(isDashboardEconomyMutationReady(liveState)).toBe(true);
    expect(isDashboardEconomyMutationReady({
      ...liveState,
      hasQueryError: true,
    })).toBe(false);
    expect(isDashboardEconomyMutationReady({
      ...liveState,
      source: "cached",
      journeyFreshness: "cached",
    })).toBe(false);
    expect(isDashboardEconomyMutationReady({
      ...liveState,
      inventoryStatus: "unavailable",
    })).toBe(false);
  });
});
