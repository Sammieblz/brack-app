import type { DashboardStreakSummary } from "@/services/api/dashboard";
import { getDateKeyInTimeZone } from "@/lib/dashboardGamification";

export type DashboardStreakState =
  | "on_track"
  | "protected"
  | "at_risk"
  | "fresh_start"
  | "lapsed";

export interface DashboardStreakPresentation {
  state: DashboardStreakState;
  currentStreak: number;
  nextMilestone: number | null;
  daysToNextMilestone: number;
  milestoneProgress: number;
  todayKey: string;
  readToday: boolean;
  protectedToday: boolean;
  canProtectToday: boolean;
}

interface DashboardStreakPresentationOptions {
  timezone: string;
  serverTime?: string | null;
  receivedAt?: string | null;
  nowMs?: number;
}

export const DASHBOARD_STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365] as const;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const shiftDateKey = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
};

const normalizeReadingDate = (value: string | null, timezone: string) => {
  if (!value) return null;
  if (DATE_KEY_PATTERN.test(value)) return value;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? getDateKeyInTimeZone(new Date(parsed), timezone)
    : null;
};

const correctedNow = ({
  serverTime,
  receivedAt,
  nowMs = Date.now(),
}: Pick<DashboardStreakPresentationOptions, "serverTime" | "receivedAt" | "nowMs">) => {
  const serverTimeMs = serverTime ? Date.parse(serverTime) : Number.NaN;
  const receivedAtMs = receivedAt ? Date.parse(receivedAt) : Number.NaN;
  if (!Number.isFinite(serverTimeMs) || !Number.isFinite(receivedAtMs)) return nowMs;
  return serverTimeMs + Math.max(0, nowMs - receivedAtMs);
};

/**
 * Converts the persisted streak summary into a time-zone-aware presentation.
 *
 * `profiles.current_streak` is event-updated and can remain non-zero after a
 * missed day until the next streak write. Comparing the last reading date to
 * the user's current local date prevents Home from presenting that stale value
 * as an active streak. Freeze eligibility remains server-authoritative; the
 * `canProtectToday` flag only controls whether Home offers the action.
 */
export const getDashboardStreakPresentation = (
  streak: DashboardStreakSummary,
  options: DashboardStreakPresentationOptions,
): DashboardStreakPresentation => {
  const timezone = options.timezone || "UTC";
  const now = correctedNow(options);
  const todayKey = getDateKeyInTimeZone(new Date(now), timezone);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const lastReadingKey = normalizeReadingDate(streak.lastReadingDate, timezone);
  const freezeKey = normalizeReadingDate(streak.freezeUsedAt, timezone);
  const persistedCurrent = Math.max(0, Math.trunc(streak.currentStreak || 0));
  const readToday = lastReadingKey === todayKey;
  const protectedToday = !readToday && freezeKey === todayKey;

  let state: DashboardStreakState;
  let currentStreak: number;

  if (readToday) {
    state = "on_track";
    currentStreak = Math.max(1, persistedCurrent);
  } else if (protectedToday) {
    state = "protected";
    currentStreak = Math.max(1, persistedCurrent);
  } else if (lastReadingKey === yesterdayKey) {
    state = "at_risk";
    currentStreak = Math.max(1, persistedCurrent);
  } else if (!lastReadingKey && persistedCurrent === 0) {
    state = "fresh_start";
    currentStreak = 0;
  } else {
    state = "lapsed";
    currentStreak = 0;
  }

  const nextMilestone = DASHBOARD_STREAK_MILESTONES.find(
    (milestone) => milestone > currentStreak,
  ) ?? null;
  const daysToNextMilestone = nextMilestone ? nextMilestone - currentStreak : 0;
  const milestoneProgress = nextMilestone
    ? Math.min(100, Math.round((currentStreak / nextMilestone) * 100))
    : 100;

  return {
    state,
    currentStreak,
    nextMilestone,
    daysToNextMilestone,
    milestoneProgress,
    todayKey,
    readToday,
    protectedToday,
    canProtectToday: state === "at_risk",
  };
};

