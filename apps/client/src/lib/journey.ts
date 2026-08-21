import type {
  GamificationAccount,
  GamificationHomeResponse,
  QuestAssignment,
} from "@/services/api/gamification";
import { getInclusivePeriodEndMs } from "@/lib/gamificationPeriod";

export type QuestAction = "timer" | "progress" | "library";
export type JourneyTabValue = "overview" | "quests" | "shop" | "badges" | "rankings";
export type GamificationHomeFreshness = "live" | "cached" | "expired";
export type JourneyEntryTelemetrySource = "dashboard_hud" | "deep_link" | "navigation";

export const JOURNEY_TAB_VALUES: ReadonlySet<JourneyTabValue> = new Set([
  "overview",
  "quests",
  "shop",
  "badges",
  "rankings",
]);

export const getJourneyEntryTelemetrySource = (
  navigationState: unknown,
  hasRequestedTab: boolean,
): JourneyEntryTelemetrySource => {
  if (navigationState
    && typeof navigationState === "object"
    && (navigationState as { journeyTelemetrySource?: unknown })
      .journeyTelemetrySource === "dashboard_hud") {
    return "dashboard_hud";
  }
  return hasRequestedTab ? "deep_link" : "navigation";
};

const isActive = (quest: QuestAssignment) => quest.status === "active";

const completionRatio = (quest: QuestAssignment) => {
  if (quest.target_value <= 0) return 0;
  return Math.min(1, Math.max(0, quest.progress_value / quest.target_value));
};

const byPeriodAndId = (left: QuestAssignment, right: QuestAssignment) =>
  left.period_end.localeCompare(right.period_end) || left.id.localeCompare(right.id);

/** Selects one stable, useful quest without depending on API response order. */
export const selectDailyFocus = (
  quests: QuestAssignment[],
): QuestAssignment | null => {
  const daily = quests.filter((quest) => quest.cadence === "daily");
  const started = daily
    .filter((quest) => isActive(quest) && quest.progress_value > 0)
    .sort((left, right) =>
      completionRatio(right) - completionRatio(left) || byPeriodAndId(left, right));

  if (started[0]) return started[0];

  const remaining = daily
    .filter(isActive)
    .sort(byPeriodAndId);

  if (remaining[0]) return remaining[0];

  const completed = daily
    .filter((quest) => quest.status === "completed")
    .sort((left, right) =>
      (right.completed_at ?? "").localeCompare(left.completed_at ?? "")
      || right.id.localeCompare(left.id));

  if (completed[0]) return completed[0];

  if (daily.length > 0) return null;

  return quests
    .filter((quest) => quest.cadence === "weekly" && isActive(quest))
    .sort((left, right) =>
      completionRatio(right) - completionRatio(left) || byPeriodAndId(left, right))[0] ?? null;
};

export const getQuestAction = (metric: string): QuestAction => {
  switch (metric) {
    case "reading_minutes":
    case "sessions":
    case "reading_sessions":
    case "reading_velocity":
    case "velocity":
    case "reading_days":
      return "timer";
    case "pages":
    case "pages_read":
      return "progress";
    case "books_completed":
    case "series_books_completed":
      return "library";
    default:
      return "library";
  }
};

export const getQuestActionLabel = (metric: string) => {
  switch (getQuestAction(metric)) {
    case "timer":
      return "Start reading";
    case "progress":
      return "Log progress";
    case "library":
      return "Open library";
  }
};

const QUEST_UNIT_LABELS: Record<string, [string, string]> = {
  reading_minutes: ["minute", "minutes"],
  sessions: ["session", "sessions"],
  reading_sessions: ["session", "sessions"],
  reading_velocity: ["page/hour", "pages/hour"],
  velocity: ["page/hour", "pages/hour"],
  reading_days: ["day", "days"],
  pages: ["page", "pages"],
  pages_read: ["page", "pages"],
  books_completed: ["book", "books"],
  series_books_completed: ["series book", "series books"],
};

export const formatQuestValue = (value: number, metric: string) => {
  const normalized = Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  const labels = QUEST_UNIT_LABELS[metric];
  if (!labels) return normalized;
  return `${normalized} ${value === 1 ? labels[0] : labels[1]}`;
};

export const getQuestProgressLabel = (quest: QuestAssignment) =>
  `${formatQuestValue(
    Math.min(quest.progress_value, quest.target_value),
    quest.metric,
  )} of ${formatQuestValue(quest.target_value, quest.metric)}`;

export interface LevelProgressDetails {
  currentInk: number;
  span: number;
  percentage: number;
  remaining: number;
  isMaximumLevel: boolean;
}

export const getLevelProgressDetails = (
  account: GamificationAccount,
): LevelProgressDetails => {
  if (!account.next_level) {
    return {
      currentInk: Math.max(0, account.lifetime_ink - account.level_threshold),
      span: 0,
      percentage: 100,
      remaining: 0,
      isMaximumLevel: true,
    };
  }

  const span = Math.max(1, account.next_level.ink_threshold - account.level_threshold);
  const currentInk = Math.min(
    span,
    Math.max(0, account.lifetime_ink - account.level_threshold),
  );

  return {
    currentInk,
    span,
    percentage: (currentInk / span) * 100,
    remaining: Math.max(0, account.next_level.ink_threshold - account.lifetime_ink),
    isMaximumLevel: false,
  };
};

export const getCorrectedNow = (
  serverTime: string,
  receivedAtMs: number,
  nowMs = Date.now(),
) => {
  const parsedServerTime = Date.parse(serverTime);
  if (!Number.isFinite(parsedServerTime)) return nowMs;
  return parsedServerTime + Math.max(0, nowMs - receivedAtMs);
};

export const formatTimeRemaining = (
  targetTime: string,
  serverTime: string,
  receivedAtMs: number,
  nowMs = Date.now(),
  timezone = "UTC",
) => {
  const target = getInclusivePeriodEndMs(targetTime, timezone);
  if (!Number.isFinite(target)) return "Reset time unavailable";

  const remainingMs = Math.max(
    0,
    target - getCorrectedNow(serverTime, receivedAtMs, nowMs),
  );
  if (remainingMs === 0) return "Resetting now";

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
};

export const getGamificationHomeBoundaryMs = (
  data: GamificationHomeResponse,
) => {
  const boundaryValues = [
    Date.parse(data.week.scoring_closes_at),
    ...data.quests.map((quest) =>
      getInclusivePeriodEndMs(quest.period_end, data.timezone)),
  ];

  if (boundaryValues.some((value) => !Number.isFinite(value))) {
    return Number.NaN;
  }

  return Math.min(...boundaryValues);
};

export const getGamificationHomeExpirationDelay = (
  data: GamificationHomeResponse,
  receivedAtMs: number,
  nowMs = Date.now(),
) => {
  const boundary = getGamificationHomeBoundaryMs(data);
  if (!Number.isFinite(boundary) || !Number.isFinite(receivedAtMs)) return 0;
  return Math.max(
    0,
    boundary - getCorrectedNow(data.server_time, receivedAtMs, nowMs),
  );
};

export const getGamificationHomeFreshness = (
  data: GamificationHomeResponse | null | undefined,
  nowMs = Date.now(),
  liveReceivedAtMs = nowMs,
): GamificationHomeFreshness => {
  if (!data) return "live";

  const receivedAtMs = data.source === "cached"
    ? data.cached_at ? Date.parse(data.cached_at) : Number.NaN
    : liveReceivedAtMs;
  if (!Number.isFinite(receivedAtMs)) return "expired";

  const expirationDelay = getGamificationHomeExpirationDelay(data, receivedAtMs, nowMs);
  if (expirationDelay <= 0) return "expired";
  return data.source === "cached" ? "cached" : "live";
};

/**
 * React Query persists the response payload, including its original `live`
 * label. Hydration is not a network confirmation in the current app session,
 * so expose that payload as a read-only cached snapshot until this mount has
 * observed a successful live request.
 */
export const getGamificationHomePresentationData = (
  data: GamificationHomeResponse | null | undefined,
  liveReceivedAtMs: number,
  hasCurrentSessionLiveResponse: boolean,
): GamificationHomeResponse | undefined => {
  if (!data) return undefined;
  if (hasCurrentSessionLiveResponse && data.source === "live") return data;
  if (data.source === "cached" && data.cached_at) return data;

  const cachedAt = Number.isFinite(liveReceivedAtMs) && liveReceivedAtMs > 0
    ? new Date(liveReceivedAtMs).toISOString()
    : null;

  return {
    ...data,
    source: "cached",
    cached_at: data.cached_at ?? cachedAt,
  };
};
