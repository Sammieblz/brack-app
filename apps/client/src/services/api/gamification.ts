import { invokeFunction } from "./client";
import { getCurrentAuthUser } from "./auth";
import { profilePreferencesRepo } from "@/services/local";
import { isConnectivityAvailable } from "@/services/connectivity";
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

const cacheKey = (userId: string) => `brack:gamification-home:${userId}`;

export const readCachedGamificationHome = (
  userId: string,
): GamificationHomeResponse | null => {
  try {
    const value = localStorage.getItem(cacheKey(userId));
    return value ? JSON.parse(value) as GamificationHomeResponse : null;
  } catch {
    return null;
  }
};

const cacheGamificationHome = (userId: string, data: GamificationHomeResponse) => {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(data));
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
    cacheGamificationHome(userId, data);
    return data;
  } catch (error) {
    const cached = readCachedGamificationHome(userId);
    if (cached) return cached;
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
  scope: LeaderboardScope,
  weekId?: string | null,
): Promise<LeaderboardResponse> => {
  const user = await getCurrentAuthUser();
  const key = user
    ? `brack:leaderboard:${user.id}:${scope}:${weekId ?? "current"}`
    : null;
  try {
    const response = await invokeFunction<LeaderboardResponse>("leaderboard", {
      body: { scope, week_id: weekId ?? null, limit: 100 },
    });
    if (key) localStorage.setItem(key, JSON.stringify(response));
    return response;
  } catch (error) {
    if (key) {
      const cached = localStorage.getItem(key);
      if (cached) return JSON.parse(cached) as LeaderboardResponse;
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

export const getPublicGamificationProfile = async (
  userId: string,
): Promise<PublicGamificationProfile | null> => {
  const response = await invokeFunction<{ gamification: PublicGamificationProfile | null }>(
    "profile-gamification",
    { body: { user_id: userId } },
  );
  return response.gamification;
};
