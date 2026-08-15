import type { QueryClient } from "@tanstack/react-query";

const DASHBOARD_HOME_SCHEMA_VERSION = 2;
export const DASHBOARD_FORCE_REFRESH_INTERVAL_MS = 5_000;
const dashboardForceRefreshClaims = new Map<string, number>();
type DashboardFetchObservationSource = "live" | "cached" | "error";
interface DashboardFetchObservation {
  generation: number;
  source: DashboardFetchObservationSource | null;
}
const dashboardFetchObservations = new Map<string, DashboardFetchObservation>();

export const getDashboardFetchObservation = (
  userId?: string,
): DashboardFetchObservation => userId
  ? dashboardFetchObservations.get(userId) ?? { generation: 0, source: null }
  : { generation: 0, source: null };

export const recordDashboardFetchObservation = (
  userId: string,
  source: DashboardFetchObservationSource,
) => {
  const previous = getDashboardFetchObservation(userId);
  const next = { generation: previous.generation + 1, source };
  dashboardFetchObservations.set(userId, next);
  return next;
};

export const dashboardHomeQueryKey = (
  userId?: string,
  includeJourney = false,
  recentLimit = 10,
) => [
  "dashboard-home",
  DASHBOARD_HOME_SCHEMA_VERSION,
  userId,
  recentLimit,
  { includeJourney },
] as const;

/**
 * Invalidate every dashboard-home variant for one reader. The prefix deliberately
 * excludes recentLimit/includeJourney so mutations refresh core-only and combined
 * consumers without coupling callers to a particular Dashboard request shape.
 */
export const invalidateDashboardHomeQueries = (
  queryClient: QueryClient,
  userId?: string,
) => queryClient.invalidateQueries({
  queryKey: userId
    ? ["dashboard-home", DASHBOARD_HOME_SCHEMA_VERSION, userId]
    : ["dashboard-home", DASHBOARD_HOME_SCHEMA_VERSION],
});

interface DashboardEconomyMutationState {
  hasCurrentSessionLiveResponse: boolean;
  hasQueryError: boolean;
  source: "live" | "cached" | null;
  journeyFreshness: "live" | "cached" | "expired" | "unavailable" | "not_requested";
  inventoryStatus: "ok" | "not_requested" | "unavailable" | null;
}

/**
 * Persisted query data may retain its original `live` provenance after hydration.
 * Economy mutations require a successful live response observed in this app
 * session, in addition to the response's inventory and freshness markers.
 */
export const isDashboardEconomyMutationReady = ({
  hasCurrentSessionLiveResponse,
  hasQueryError,
  source,
  journeyFreshness,
  inventoryStatus,
}: DashboardEconomyMutationState) => hasCurrentSessionLiveResponse
  && !hasQueryError
  && source === "live"
  && journeyFreshness === "live"
  && inventoryStatus === "ok";

/**
 * Shares the forced-refresh rate gate across Dashboard consumers and remounts.
 * Five seconds matches the Edge limit of 12 forced refreshes per minute.
 */
export const claimDashboardHomeForceRefresh = (
  userId: string,
  now = Date.now(),
) => {
  const previous = dashboardForceRefreshClaims.get(userId);
  if (previous === undefined) {
    dashboardForceRefreshClaims.set(userId, now);
    return { allowed: true as const, retryAfterMs: 0 };
  }
  const retryAfterMs = Math.max(
    0,
    DASHBOARD_FORCE_REFRESH_INTERVAL_MS - (now - previous),
  );
  if (retryAfterMs > 0) return { allowed: false as const, retryAfterMs };

  dashboardForceRefreshClaims.set(userId, now);
  return { allowed: true as const, retryAfterMs: 0 };
};
