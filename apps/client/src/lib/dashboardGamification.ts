import type { Goal } from "@/types";
import type {
  DashboardCoreStats,
  DashboardRecentActivity,
} from "@/services/api/dashboard";
import type { GamificationAccount, QuestAssignment } from "@/services/api/gamification";
import { questProgressPercent } from "@/lib/gamification";
import { getInclusivePeriodEndMs } from "@/lib/gamificationPeriod";

export type DailyFocusAction = "timer" | "progress" | "library";

export interface LevelProgressDetails {
  percent: number;
  earnedInLevel: number;
  levelSpan: number;
  inkToNextLevel: number;
  isMaximumLevel: boolean;
}

export const getLevelProgressDetails = (
  account: GamificationAccount | null | undefined,
): LevelProgressDetails => {
  if (!account) {
    return {
      percent: 0,
      earnedInLevel: 0,
      levelSpan: 0,
      inkToNextLevel: 0,
      isMaximumLevel: false,
    };
  }

  if (!account.next_level) {
    return {
      percent: 100,
      earnedInLevel: Math.max(0, account.lifetime_ink - account.level_threshold),
      levelSpan: 0,
      inkToNextLevel: 0,
      isMaximumLevel: true,
    };
  }

  const levelSpan = Math.max(1, account.next_level.ink_threshold - account.level_threshold);
  const earnedInLevel = Math.min(
    levelSpan,
    Math.max(0, account.lifetime_ink - account.level_threshold),
  );

  return {
    percent: (earnedInLevel / levelSpan) * 100,
    earnedInLevel,
    levelSpan,
    inkToNextLevel: Math.max(0, account.next_level.ink_threshold - account.lifetime_ink),
    isMaximumLevel: false,
  };
};

const stableQuestOrder = (left: QuestAssignment, right: QuestAssignment) =>
  Date.parse(left.period_end) - Date.parse(right.period_end)
  || left.id.localeCompare(right.id);

const activeQuestOrder = (left: QuestAssignment, right: QuestAssignment) => {
  const leftStarted = left.progress_value > 0 ? 1 : 0;
  const rightStarted = right.progress_value > 0 ? 1 : 0;
  if (leftStarted !== rightStarted) return rightStarted - leftStarted;

  if (leftStarted && rightStarted) {
    const ratioDifference = questProgressPercent(
      right.progress_value,
      right.target_value,
    ) - questProgressPercent(left.progress_value, left.target_value);
    if (ratioDifference !== 0) return ratioDifference;
  }

  return stableQuestOrder(left, right);
};

export const selectDailyFocusQuest = (
  quests: QuestAssignment[] | null | undefined,
): QuestAssignment | null => {
  if (!quests?.length) return null;

  const daily = quests.filter((quest) => quest.cadence === "daily");
  const activeDaily = daily.filter((quest) => quest.status === "active");
  if (activeDaily.length > 0) return [...activeDaily].sort(activeQuestOrder)[0];

  const completedDaily = daily
    .filter((quest) => quest.status === "completed")
    .sort((left, right) =>
      Date.parse(right.completed_at ?? right.period_end)
      - Date.parse(left.completed_at ?? left.period_end)
      || left.id.localeCompare(right.id));
  if (completedDaily.length > 0) return completedDaily[0];
  if (daily.length > 0) return null;

  const activeWeekly = quests.filter(
    (quest) => quest.cadence === "weekly" && quest.status === "active",
  );
  return activeWeekly.length > 0 ? [...activeWeekly].sort(activeQuestOrder)[0] : null;
};

const METRIC_UNITS: Record<string, { singular: string; plural: string }> = {
  reading_minutes: { singular: "minute", plural: "minutes" },
  minutes_read: { singular: "minute", plural: "minutes" },
  pages_read: { singular: "page", plural: "pages" },
  reading_sessions: { singular: "session", plural: "sessions" },
  sessions: { singular: "session", plural: "sessions" },
  reading_days: { singular: "day", plural: "days" },
  books_completed: { singular: "book", plural: "books" },
  series_books_completed: { singular: "series book", plural: "series books" },
  reading_velocity: { singular: "page/hour", plural: "pages/hour" },
  velocity: { singular: "page/hour", plural: "pages/hour" },
};

export const getQuestUnit = (metric: string, value: number) => {
  const unit = METRIC_UNITS[metric];
  if (!unit) return "points";
  return value === 1 ? unit.singular : unit.plural;
};

export const formatQuestValue = (metric: string, value: number) =>
  `${Math.max(0, value).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${getQuestUnit(metric, value)}`;

export const getQuestAction = (metric: string): DailyFocusAction => {
  if ([
    "reading_minutes",
    "minutes_read",
    "reading_sessions",
    "sessions",
    "reading_velocity",
    "velocity",
    "reading_days",
  ].includes(metric)) {
    return "timer";
  }

  if (metric === "pages_read") return "progress";
  return "library";
};

export const getQuestActionLabel = (metric: string, hasCurrentBook: boolean) => {
  const action = getQuestAction(metric);
  if (action === "timer") return hasCurrentBook ? "Start reading" : "Choose a book";
  if (action === "progress") return hasCurrentBook ? "Log progress" : "Choose a book";
  return "Open library";
};

export const getQuestRemainingMs = (
  periodEnd: string,
  serverTime: string | null | undefined,
  receivedAtMs: number,
  nowMs = Date.now(),
  timezone = "UTC",
) => {
  const periodEndMs = getInclusivePeriodEndMs(periodEnd, timezone);
  if (!Number.isFinite(periodEndMs)) return 0;

  const parsedServerTime = serverTime ? Date.parse(serverTime) : Number.NaN;
  const correctedNow = Number.isFinite(parsedServerTime)
    ? parsedServerTime + Math.max(0, nowMs - receivedAtMs)
    : nowMs;
  return Math.max(0, periodEndMs - correctedNow);
};

export const formatQuestCountdown = (remainingMs: number) => {
  if (remainingMs <= 0) return "Resetting now";
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};

export interface GoalProgressDetails {
  current: number;
  target: number;
  percent: number;
  unit: string;
}

export const getGoalProgressDetails = (
  goal: Goal | null | undefined,
  stats: DashboardCoreStats | null | undefined,
): GoalProgressDetails | null => {
  if (!goal || !stats) return null;

  const values = goal.goal_type === "pages_count"
    ? { current: stats.pagesRead, target: goal.target_pages ?? 0, unit: "pages" }
    : goal.goal_type === "reading_time"
      ? { current: stats.readingMinutes, target: goal.target_minutes ?? 0, unit: "minutes" }
      : { current: stats.completedBooks, target: goal.target_books ?? 0, unit: "books" };

  return {
    ...values,
    percent: values.target > 0 ? Math.min(100, (values.current / values.target) * 100) : 0,
  };
};

/**
 * Summarizes only the capped recent-activity sample supplied by dashboard-home.
 * This is intentionally not described as a complete weekly aggregate.
 */
export const getRecentActivityInsight = (
  activities: DashboardRecentActivity[] | null | undefined,
) => {
  const sample = activities ?? [];
  const sessionMinutes = sample.reduce((total, activity) => {
    if (activity.type !== "reading_session") return total;
    const duration = Number(activity.details.duration ?? 0);
    return total + (Number.isFinite(duration) ? Math.max(0, duration) : 0);
  }, 0);

  return { activityCount: sample.length, sessionMinutes };
};

export const getDateKeyInTimeZone = (date: Date, timezone: string) => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((entry) => entry.type === type)?.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
};
