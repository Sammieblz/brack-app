import type { Book, Goal } from "@/types";
import { getApiErrorStatus, invokeFunction } from "./client";
import type { AwardedBadge } from "./badges";
import {
  GAMIFICATION_SHOP_ITEM_CODES,
  getGamificationShop,
  type GamificationAccount,
  type GamificationHomeResponse,
  type GamificationWeek,
  type InkLedgerEntry,
  type QuestAssignment,
  type ReaderLeague,
} from "./gamification";
import { isRetryableConnectivityError } from "@/services/connectivity";
import { getInclusivePeriodEndMs } from "@/lib/gamificationPeriod";

export type DashboardLastActivityType =
  | "progress_log"
  | "reading_session"
  | "book_update"
  | "date_started"
  | "created";

export interface DashboardBookCandidate {
  book: Book;
  lastActivityAt: string;
  lastActivityType: DashboardLastActivityType;
  progressPercent: number;
  ctaLabel: string;
}

export interface DashboardTodaySummary {
  minutes: number;
  sessionCount: number;
  progressMinutes?: number;
  progressLogCount: number;
}

export interface DashboardStreakSummary {
  currentStreak: number;
  longestStreak: number;
  lastReadingDate: string | null;
  freezeUsedAt: string | null;
}

export interface DashboardCoreStats {
  totalBooks: number;
  completedBooks: number;
  readingBooks: number;
  toReadBooks: number;
  pagesRead: number;
  readingMinutes: number;
}

export interface DashboardRecentActivity {
  id: string;
  type: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export interface DashboardStreakFreezeSummary {
  code: string;
  display_name: string;
  description: string;
  gold_leaves_cost: number;
  max_inventory: number;
  quantity: number;
  can_purchase: boolean;
}

export type DashboardMilestone =
  | {
      kind: "reward";
      id: string;
      title: string;
      event_type: string;
      ink_delta: number;
      gold_leaves_delta: number;
      earned_at: string;
    }
  | {
      kind: "badge";
      id: string;
      title: string;
      description: string | null;
      icon_url: string | null;
      earned_at: string;
    };

export interface DashboardJourneySummary {
  account: GamificationAccount;
  quests: QuestAssignment[];
  league: ReaderLeague | null;
  week: GamificationWeek;
  server_time: string;
  timezone: string;
  streak_freeze: DashboardStreakFreezeSummary | null;
  latest_milestone: DashboardMilestone | null;
  /** Present when the server returned the full Journey payload; retained to seed Journey caches. */
  tomorrow_quests?: GamificationHomeResponse["tomorrow_quests"];
  /** Present when the server returned the full Journey payload; retained for reward feedback. */
  recent_rewards?: InkLedgerEntry[];
}

export interface DashboardHomeMeta {
  schema_version: 2;
  served_at: string;
  journey_status: "ok" | "not_requested" | "unavailable";
  inventory_status: "ok" | "not_requested" | "unavailable";
}

export interface DashboardHomeResponse {
  continueBooks: DashboardBookCandidate[];
  activeGoal: Goal | null;
  today: DashboardTodaySummary;
  streak: DashboardStreakSummary;
  stats: DashboardCoreStats;
  recentActivity: DashboardRecentActivity[];
  achievements: AwardedBadge[];
  journey?: DashboardJourneySummary | null;
  meta?: DashboardHomeMeta;
}

export type DashboardExperienceSource = "live" | "cached";
export type DashboardJourneyFreshness =
  | "live"
  | "cached"
  | "expired"
  | "unavailable"
  | "not_requested";

export interface DashboardExperienceResult {
  data: DashboardHomeResponse;
  source: DashboardExperienceSource;
  cachedAt: string | null;
  journeyFreshness: DashboardJourneyFreshness;
}

export interface DashboardHomeOptions {
  recentLimit?: number;
  includeJourney?: boolean;
  forceRefresh?: boolean;
}

interface DashboardSnapshot {
  version: 2;
  userId: string;
  recentLimit: number;
  includeJourney: boolean;
  savedAt: string;
  journeySavedAt: string | null;
  inventorySavedAt: string | null;
  data: DashboardHomeResponse;
}

const clampRecentLimit = (value: number) => Math.min(30, Math.max(1, Math.round(value || 10)));
const snapshotKey = (
  userId: string,
  recentLimit: number,
  includeJourney: boolean,
) => `brack:dashboard-home:v2:${userId}:${recentLimit}:${includeJourney ? "journey" : "core"}`;

const readSnapshot = (
  userId: string,
  options: Pick<Required<DashboardHomeOptions>, "recentLimit" | "includeJourney">,
): DashboardSnapshot | null => {
  try {
    const raw = localStorage.getItem(snapshotKey(
      userId,
      options.recentLimit,
      options.includeJourney,
    ));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardSnapshot;
    return parsed.version === 2
      && parsed.userId === userId
      && parsed.recentLimit === options.recentLimit
      && parsed.includeJourney === options.includeJourney
      ? parsed
      : null;
  } catch {
    return null;
  }
};

const writeSnapshot = (
  userId: string,
  options: Pick<Required<DashboardHomeOptions>, "recentLimit" | "includeJourney">,
  data: DashboardHomeResponse,
  previous: DashboardSnapshot | null,
) => {
  try {
    const savedAt = new Date().toISOString();
    const journeyIsLive = data.meta?.journey_status === "ok" && Boolean(data.journey);
    const inventoryIsLive = data.meta?.inventory_status === "ok";
    const snapshot: DashboardSnapshot = {
      version: 2,
      userId,
      recentLimit: options.recentLimit,
      includeJourney: options.includeJourney,
      savedAt,
      journeySavedAt: journeyIsLive
        ? savedAt
        : previous?.journeySavedAt ?? null,
      inventorySavedAt: inventoryIsLive
        ? savedAt
        : previous?.inventorySavedAt ?? null,
      data,
    };
    localStorage.setItem(
      snapshotKey(userId, options.recentLimit, options.includeJourney),
      JSON.stringify(snapshot),
    );
    return snapshot;
  } catch {
    return null;
  }
};

const isFallbackEligible = (error: unknown) => {
  const status = getApiErrorStatus(error);
  return status === 429 || Boolean(status && status >= 500) || isRetryableConnectivityError(error);
};

export const isDashboardJourneySnapshotExpired = (
  journey: DashboardJourneySummary | null | undefined,
  nowMs = Date.now(),
) => {
  if (!journey) return true;
  const dailyAssignments = journey.quests.filter((quest) => quest.cadence === "daily");
  const dailyPeriods = dailyAssignments
    .map((quest) => getInclusivePeriodEndMs(quest.period_end, journey.timezone))
    .filter(Number.isFinite);
  if (dailyAssignments.length > 0 && dailyPeriods.length === 0) return true;
  const weekBoundary = Date.parse(journey.week.scoring_closes_at || journey.week.week_end);
  const freshnessBoundary = dailyPeriods.length > 0
    ? Math.min(...dailyPeriods)
    : Number.isFinite(weekBoundary)
      ? weekBoundary
      : 0;
  return freshnessBoundary <= nowMs;
};

export const getDashboardJourneyCorrectedNow = (
  journey: DashboardJourneySummary | null | undefined,
  receivedAt: string | null | undefined,
  clientNowMs = Date.now(),
) => {
  const serverTimeMs = journey?.server_time ? Date.parse(journey.server_time) : Number.NaN;
  const receivedAtMs = receivedAt ? Date.parse(receivedAt) : Number.NaN;
  if (!Number.isFinite(serverTimeMs) || !Number.isFinite(receivedAtMs)) return clientNowMs;
  return serverTimeMs + Math.max(0, clientNowMs - receivedAtMs);
};

const getJourneyFreshness = (
  response: DashboardHomeResponse,
  source: DashboardExperienceSource,
  receivedAt?: string | null,
): DashboardJourneyFreshness => {
  if (response.meta?.journey_status === "not_requested") return "not_requested";
  if (!response.journey) return "unavailable";
  const correctedNow = getDashboardJourneyCorrectedNow(
    response.journey,
    receivedAt,
  );
  if (response.meta?.journey_status === "unavailable") {
    return isDashboardJourneySnapshotExpired(response.journey, correctedNow)
      ? "expired"
      : "cached";
  }
  if (source === "live") return "live";
  return isDashboardJourneySnapshotExpired(response.journey, correctedNow)
    ? "expired"
    : "cached";
};

const getLegacyJourney = async (
  userId: string,
  core: DashboardHomeResponse,
): Promise<DashboardHomeResponse> => {
  const [journeyResult, shopResult] = await Promise.allSettled([
    invokeFunction<GamificationHomeResponse>("gamification-home", { method: "GET" }),
    getGamificationShop(),
  ]);

  const journey = journeyResult.status === "fulfilled" ? journeyResult.value : null;
  const shop = shopResult.status === "fulfilled" ? shopResult.value : null;
  const freezeItem = shop?.items.find(
    (item) => item.code === GAMIFICATION_SHOP_ITEM_CODES.streakFreeze,
  ) ?? null;
  const latestReward = journey?.recent_rewards.find(
    (reward) => reward.ink_delta > 0 || reward.gold_leaves_delta > 0,
  ) ?? null;

  return {
    ...core,
    journey: journey ? {
      ...journey,
      streak_freeze: freezeItem,
      latest_milestone: latestReward ? {
        kind: "reward",
        id: latestReward.id,
        title: latestReward.display_name,
        event_type: latestReward.event_type,
        ink_delta: latestReward.ink_delta,
        gold_leaves_delta: latestReward.gold_leaves_delta,
        earned_at: latestReward.created_at,
      } : core.achievements[0] ? {
        kind: "badge",
        id: core.achievements[0].id,
        title: core.achievements[0].title,
        description: core.achievements[0].description,
        icon_url: core.achievements[0].icon_url ?? null,
        earned_at: core.achievements[0].earned_at ?? new Date().toISOString(),
      } : null,
    } : null,
    meta: {
      schema_version: 2,
      served_at: new Date().toISOString(),
      journey_status: journey ? "ok" : "unavailable",
      inventory_status: shop ? "ok" : "unavailable",
    },
  };
};

const requestDashboardHome = async (
  userId: string,
  options: Required<DashboardHomeOptions>,
): Promise<DashboardHomeResponse> => {
  const raw = await invokeFunction<DashboardHomeResponse>("dashboard-home", {
    body: {
      recent_limit: clampRecentLimit(options.recentLimit),
      include_journey: options.includeJourney,
      force_refresh: options.forceRefresh,
    },
  });

  if (!options.includeJourney) return raw;
  if (raw.meta?.schema_version === 2) return raw;
  return getLegacyJourney(userId, raw);
};

/**
 * Backwards-compatible core loader. New Dashboard callers should use
 * `getDashboardExperience` to receive cache provenance and Journey freshness.
 */
export const getDashboardHome = async (recentLimit = 10): Promise<DashboardHomeResponse> =>
  invokeFunction<DashboardHomeResponse>("dashboard-home", {
    body: { recent_limit: clampRecentLimit(recentLimit) },
  });

export const getDashboardExperience = async (
  userId: string,
  options: DashboardHomeOptions = {},
): Promise<DashboardExperienceResult> => {
  const resolved: Required<DashboardHomeOptions> = {
    recentLimit: clampRecentLimit(options.recentLimit ?? 10),
    includeJourney: options.includeJourney ?? false,
    forceRefresh: options.forceRefresh ?? false,
  };
  const previous = readSnapshot(userId, resolved);

  try {
    const liveData = await requestDashboardHome(userId, resolved);
    const shouldRestoreJourney = resolved.includeJourney
      && liveData.meta?.journey_status === "unavailable"
      && !liveData.journey
      && Boolean(previous?.data.journey);
    const shouldRestoreInventory = resolved.includeJourney
      && liveData.meta?.inventory_status === "unavailable"
      && Boolean(liveData.journey)
      && Boolean(previous?.data.journey?.streak_freeze);
    const data = shouldRestoreJourney ? {
      ...liveData,
      journey: previous?.data.journey ?? null,
    } : shouldRestoreInventory && liveData.journey ? {
      ...liveData,
      journey: {
        ...liveData.journey,
        streak_freeze: previous?.data.journey?.streak_freeze ?? null,
      },
    } : liveData;
    const saved = writeSnapshot(userId, resolved, data, previous);
    const cachedAt = shouldRestoreJourney
      ? previous?.journeySavedAt ?? previous?.savedAt ?? null
      : saved?.journeySavedAt ?? saved?.savedAt ?? null;
    return {
      data,
      source: "live",
      cachedAt,
      journeyFreshness: resolved.includeJourney
        ? getJourneyFreshness(data, "live", cachedAt)
        : "not_requested",
    };
  } catch (error) {
    if (!isFallbackEligible(error)) throw error;
    const snapshot = readSnapshot(userId, resolved);
    if (!snapshot) throw error;
    return {
      data: snapshot.data,
      source: "cached",
      cachedAt: snapshot.journeySavedAt ?? snapshot.savedAt,
      journeyFreshness: resolved.includeJourney
        ? getJourneyFreshness(
            snapshot.data,
            "cached",
            snapshot.journeySavedAt ?? snapshot.savedAt,
          )
        : "not_requested",
    };
  }
};
