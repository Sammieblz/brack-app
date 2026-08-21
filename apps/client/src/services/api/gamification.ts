import { getApiErrorStatus, invokeFunction } from "./client";
import { getCurrentAuthUser } from "./auth";
import { profilePreferencesRepo } from "@/services/local";
import {
  isConnectivityAvailable,
  isRetryableConnectivityError,
} from "@/services/connectivity";
import { readingCoreSync } from "@/services/sync/engine";

export type QuestCadence = "daily" | "weekly";
export type QuestStatus = "active" | "completed" | "expired";
export type LeaderboardScope = "league" | "friends" | "global";

export interface ReaderLevel {
  level: number;
  title: string;
  ink_threshold: number;
}

export interface GamificationAccount {
  user_id: string;
  lifetime_ink: number;
  gold_leaves: number;
  current_level: number;
  level_title: string;
  level_threshold: number;
  next_level: ReaderLevel | null;
  leaderboard_opt_in: boolean;
  leaderboard_eligible_from: string | null;
  gamification_profile_visible: boolean;
}

export interface PublicGamificationProfile {
  level: number;
  level_title: string;
  lifetime_ink: number;
  gold_leaves: number | null;
  league_name: string | null;
  league_rank: number | null;
  league_status: "active" | "finalized" | null;
}

export interface InkLedgerEntry {
  id: string;
  event_type: string;
  display_name: string;
  ink_delta: number;
  competitive_ink_delta?: number;
  gold_leaves_delta: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface QuestAssignment {
  id: string;
  template_id?: string;
  code?: string;
  title: string;
  description: string;
  cadence: QuestCadence;
  metric: string;
  target_value: number;
  progress_value: number;
  reward_ink: number;
  reward_gold_leaves: number;
  status: QuestStatus;
  period_start: string;
  period_end: string;
  completed_at: string | null;
}

export interface ReaderLeague {
  league_id: string;
  name: string;
  tier: number;
  week_id: string;
  score: number;
  provisional_rank: number;
  member_count: number;
  status: "active" | "finalized";
}

export interface GamificationWeek {
  id: string;
  week_start: string;
  week_end: string;
  scoring_closes_at: string;
  status: "scheduled" | "active" | "grace" | "finalized";
  finalized_at: string | null;
}

export interface GamificationHomeResponse {
  account: GamificationAccount;
  quests: QuestAssignment[];
  tomorrow_quests: Array<Pick<
    QuestAssignment,
    "id" | "title" | "description" | "metric" | "target_value" | "reward_ink"
  >>;
  recent_rewards: InkLedgerEntry[];
  league: ReaderLeague | null;
  week: GamificationWeek;
  server_time: string;
  timezone: string;
  source?: "live" | "cached";
  cached_at?: string | null;
}

export interface LeaderboardEntry {
  user_id: string;
  rank: number;
  competitive_ink: number;
  quests_completed: number;
  qualifying_minutes: number;
  reading_days: number;
  display_name: string;
  avatar_url: string | null;
  level: number | null;
  level_title: string | null;
  is_current_user: boolean;
}

export interface LeaderboardResponse {
  week: GamificationWeek;
  scope: LeaderboardScope;
  entries: LeaderboardEntry[];
  source?: "live" | "cached";
}

export interface GamificationHistoryResponse {
  items: InkLedgerEntry[];
  next_cursor: string | null;
}

export interface GamificationSettingsInput {
  leaderboard_opt_in?: boolean;
  gamification_profile_visible?: boolean;
  timezone?: string;
}

export interface GamificationSettingsResponse {
  success: boolean;
  leaderboard_opt_in: boolean;
  leaderboard_eligible_from: string | null;
  gamification_profile_visible: boolean;
  timezone: string;
}

export const GAMIFICATION_SHOP_ITEM_CODES = {
  streakFreeze: "streak_freeze",
} as const;

export interface GamificationShopAccount {
  user_id: string;
  gold_leaves: number;
}

export interface GamificationShopItem {
  code: string;
  display_name: string;
  description: string;
  item_type: string;
  gold_leaves_cost: number;
  max_inventory: number;
  quantity: number;
  can_purchase: boolean;
  config: Record<string, unknown>;
}

export interface GamificationShopResponse {
  account: GamificationShopAccount;
  items: GamificationShopItem[];
  source?: "live" | "cached";
  cached_at?: string | null;
}

export interface GamificationShopPurchaseInput {
  itemCode: string;
  quantity: 1;
  idempotencyKey: string;
}

export interface GamificationShopPurchaseResult {
  success: boolean;
  idempotent: boolean;
  purchase: {
    id: string;
    item_code: string;
    quantity: number;
    unit_cost_gold_leaves: number;
    gold_leaves_spent: number;
    created_at: string;
  };
  account: GamificationShopAccount;
  inventory: {
    item_code: string;
    quantity: number;
    max_inventory: number;
  };
}

interface GamificationHomeSnapshot {
  version: 2;
  savedAt: string;
  data: Omit<GamificationHomeResponse, "source" | "cached_at">;
}

const cacheKey = (userId: string) => `brack:gamification-home:v2:${userId}`;
const legacyCacheKey = (userId: string) => `brack:gamification-home:${userId}`;

export function isGamificationFallbackEligible(error: unknown) {
  const status = getApiErrorStatus(error);
  return status === 429
    || Boolean(status && status >= 500)
    || isRetryableConnectivityError(error);
}

const isGamificationHomePayload = (
  value: unknown,
  userId: string,
): value is Omit<GamificationHomeResponse, "source" | "cached_at"> => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GamificationHomeResponse>;
  return candidate.account?.user_id === userId
    && Array.isArray(candidate.quests)
    && Array.isArray(candidate.tomorrow_quests)
    && Array.isArray(candidate.recent_rewards)
    && typeof candidate.week?.scoring_closes_at === "string"
    && typeof candidate.server_time === "string"
    && Number.isFinite(Date.parse(candidate.server_time))
    && typeof candidate.timezone === "string";
};

export const readCachedGamificationHome = (
  userId: string,
): GamificationHomeResponse | null => {
  try {
    const value = localStorage.getItem(cacheKey(userId));
    if (value) {
      const snapshot = JSON.parse(value) as Partial<GamificationHomeSnapshot>;
      if (snapshot.version === 2
        && typeof snapshot.savedAt === "string"
        && Number.isFinite(Date.parse(snapshot.savedAt))
        && isGamificationHomePayload(snapshot.data, userId)) {
        return {
          ...snapshot.data,
          source: "cached",
          cached_at: snapshot.savedAt,
        };
      }
    }

    // One-release migration path: balances remain useful, while a missing
    // receipt timestamp makes quest and League freshness conservatively expired.
    const legacyValue = localStorage.getItem(legacyCacheKey(userId));
    if (!legacyValue) return null;
    const legacy = JSON.parse(legacyValue) as unknown;
    if (!isGamificationHomePayload(legacy, userId)) return null;
    return { ...legacy, source: "cached", cached_at: null };
  } catch {
    return null;
  }
};

export const cacheGamificationHomeResponse = (
  userId: string,
  data: GamificationHomeResponse,
) => {
  if (!isGamificationHomePayload(data, userId)) return;
  try {
    const { source: _source, cached_at: _cachedAt, ...payload } = data;
    const snapshot: GamificationHomeSnapshot = {
      version: 2,
      savedAt: new Date().toISOString(),
      data: payload,
    };
    localStorage.setItem(cacheKey(userId), JSON.stringify(snapshot));
  } catch {
    // React Query persistence remains the secondary cache in constrained runtimes.
  }
};

export const getGamificationHome = async (
  userId: string,
): Promise<GamificationHomeResponse> => {
  try {
    const data = await invokeFunction<GamificationHomeResponse>("gamification-home", {
      method: "GET",
    });
    const liveData: GamificationHomeResponse = {
      ...data,
      source: "live",
      cached_at: null,
    };
    cacheGamificationHomeResponse(userId, liveData);
    return liveData;
  } catch (error) {
    if (isGamificationFallbackEligible(error)) {
      const cached = readCachedGamificationHome(userId);
      if (cached) return cached;
    }
    throw error;
  }
};

export const getGamificationHistory = async (
  before?: string | null,
): Promise<GamificationHistoryResponse> =>
  invokeFunction<GamificationHistoryResponse>("gamification-history", {
    body: { before: before ?? null, limit: 30 },
  });

export const getLeaderboard = async (
  userId: string,
  scope: LeaderboardScope,
  weekId?: string | null,
): Promise<LeaderboardResponse> => {
  const key = `brack:leaderboard:${userId}:${scope}:${weekId ?? "current"}`;
  try {
    const response = await invokeFunction<LeaderboardResponse>("leaderboard", {
      body: { scope, week_id: weekId ?? null, limit: 100 },
    });
    try {
      localStorage.setItem(key, JSON.stringify(response));
    } catch {
      // Live standings remain usable when device storage is unavailable.
    }
    return { ...response, source: "live" };
  } catch (error) {
    const status = getApiErrorStatus(error);
    const canUseCache = status === 429
      || Boolean(status && status >= 500)
      || isRetryableConnectivityError(error);
    if (canUseCache) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const parsed = JSON.parse(cached) as LeaderboardResponse;
          if (!Array.isArray(parsed.entries)
            || parsed.scope !== scope
            || (weekId && parsed.week?.id !== weekId)) {
            throw new Error("Invalid leaderboard cache");
          }
          return {
            ...parsed,
            source: "cached",
          };
        }
      } catch {
        // Fall through to the original request error for malformed/unavailable storage.
      }
    }
    throw error;
  }
};

export const updateGamificationSettings = async (
  input: GamificationSettingsInput,
): Promise<GamificationSettingsResponse> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const existing = await profilePreferencesRepo.get(user.id);
  const updatedAt = new Date().toISOString();
  await profilePreferencesRepo.upsertLocal(user.id, {
    ...existing,
    id: user.id,
    timezone: input.timezone ?? existing?.timezone ?? "UTC",
    leaderboard_opt_in:
      input.leaderboard_opt_in ?? existing?.leaderboard_opt_in ?? false,
    gamification_profile_visible:
      input.gamification_profile_visible
      ?? existing?.gamification_profile_visible
      ?? true,
    updated_at: updatedAt,
  });

  if (!isConnectivityAvailable()) {
    return {
      success: true,
      leaderboard_opt_in:
        input.leaderboard_opt_in ?? existing?.leaderboard_opt_in ?? false,
      leaderboard_eligible_from: existing?.leaderboard_eligible_from ?? null,
      gamification_profile_visible:
        input.gamification_profile_visible
        ?? existing?.gamification_profile_visible
        ?? true,
      timezone: input.timezone ?? existing?.timezone ?? "UTC",
    };
  }

  const response = await invokeFunction<GamificationSettingsResponse>(
    "update-gamification-settings",
    {
    body: input,
    },
  );
  await profilePreferencesRepo.upsertRemote(user.id, {
    ...existing,
    id: user.id,
    timezone: response.timezone,
    leaderboard_opt_in: response.leaderboard_opt_in,
    leaderboard_eligible_from: response.leaderboard_eligible_from,
    gamification_profile_visible: response.gamification_profile_visible,
    updated_at: updatedAt,
  });
  void readingCoreSync.syncUser(user.id).catch(console.error);
  return response;
};

interface GamificationShopSnapshot {
  version: 1;
  savedAt: string;
  data: Pick<GamificationShopResponse, "account" | "items">;
}

const gamificationShopCacheKey = (userId: string) =>
  `brack:gamification-shop:v1:${userId}`;

export const cacheGamificationShopResponse = (
  userId: string,
  response: GamificationShopResponse,
) => {
  try {
    const snapshot: GamificationShopSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      data: {
        account: response.account,
        items: response.items,
      },
    };
    localStorage.setItem(gamificationShopCacheKey(userId), JSON.stringify(snapshot));
  } catch {
    // React Query remains the in-memory fallback when storage is unavailable.
  }
};

const readGamificationShopSnapshot = (
  userId: string,
): GamificationShopSnapshot | null => {
  try {
    const raw = localStorage.getItem(gamificationShopCacheKey(userId));
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Partial<GamificationShopSnapshot>;
    if (snapshot.version !== 1
      || typeof snapshot.savedAt !== "string"
      || !snapshot.data
      || !Array.isArray(snapshot.data.items)
      || typeof snapshot.data.account?.gold_leaves !== "number"
      || snapshot.data.account.user_id !== userId) {
      return null;
    }
    return snapshot as GamificationShopSnapshot;
  } catch {
    return null;
  }
};

export const getGamificationShop = async (
  userId?: string,
): Promise<GamificationShopResponse> => {
  try {
    const response = await invokeFunction<GamificationShopResponse>("gamification-shop", {
      method: "GET",
    });
    const liveResponse: GamificationShopResponse = {
      account: response.account,
      items: response.items,
      source: "live",
      cached_at: null,
    };
    if (userId) cacheGamificationShopResponse(userId, liveResponse);
    return liveResponse;
  } catch (error) {
    if (userId && isGamificationFallbackEligible(error)) {
      const snapshot = readGamificationShopSnapshot(userId);
      if (snapshot) {
        return {
          ...snapshot.data,
          source: "cached",
          cached_at: snapshot.savedAt,
        };
      }
    }
    throw error;
  }
};

export const purchaseGamificationShopItem = async (
  input: GamificationShopPurchaseInput,
): Promise<GamificationShopPurchaseResult> => {
  const result = await invokeFunction<GamificationShopPurchaseResult>("gamification-shop", {
    method: "POST",
    body: input,
  });
  if (!result.success) throw new Error("Gamification shop purchase was not completed");
  return result;
};

export const getPublicGamificationProfile = async (
  userId: string,
): Promise<PublicGamificationProfile | null> => {
  const response = await invokeFunction<{ gamification: PublicGamificationProfile | null }>(
    "profile-gamification",
    { body: { user_id: userId } },
  );
  return response.gamification;
};
