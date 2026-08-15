export const DASHBOARD_HOME_SCHEMA_VERSION = 2 as const;

export type JourneySectionStatus = "ok" | "not_requested" | "unavailable";

export type DashboardHomeMeta = {
  schema_version: typeof DASHBOARD_HOME_SCHEMA_VERSION;
  served_at: string;
  journey_status: JourneySectionStatus;
  inventory_status: JourneySectionStatus;
};

export type StreakFreezeSummary = {
  code: string;
  display_name: string;
  description: string;
  gold_leaves_cost: number;
  max_inventory: number;
  quantity: number;
  can_purchase: boolean;
};

export type RewardMilestone = {
  kind: "reward";
  id: string;
  title: string;
  event_type: string;
  ink_delta: number;
  gold_leaves_delta: number;
  earned_at: string;
};

export type BadgeMilestone = {
  kind: "badge";
  id: string;
  title: string;
  description: string | null;
  icon_url: string | null;
  earned_at: string;
};

export type DashboardJourneySummary = {
  account: Record<string, unknown>;
  quests: unknown[];
  tomorrow_quests: unknown[];
  recent_rewards: unknown[];
  league: Record<string, unknown> | null;
  week: Record<string, unknown>;
  server_time: string;
  timezone: string;
  streak_freeze: StreakFreezeSummary | null;
  latest_milestone: RewardMilestone | BadgeMilestone | null;
};

export type DashboardRpcResult = {
  data: unknown;
  error: unknown;
};

export type DashboardHomeComposition = {
  response: JsonRecord & {
    journey: DashboardJourneySummary | null;
    meta: DashboardHomeMeta;
  };
  journey_error: unknown;
  inventory_error: unknown;
};

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requiredString = (record: JsonRecord, key: string): string => {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid Journey response field: ${key}`);
  }
  return value;
};

const optionalString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const finiteNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const timestampValue = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

export const parseOptionalBoolean = (
  value: unknown,
  fieldName: string,
): boolean | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  throw new Error(`${fieldName} must be a boolean`);
};

export const extractStreakFreeze = (
  shopValue: unknown,
): StreakFreezeSummary | null => {
  if (!isRecord(shopValue) || !Array.isArray(shopValue.items)) return null;

  const item = shopValue.items.find(
    (candidate) => isRecord(candidate) && candidate.code === "streak_freeze",
  );
  if (!isRecord(item)) return null;

  return {
    code: "streak_freeze",
    display_name: optionalString(item.display_name) ?? "Streak Freeze",
    description: optionalString(item.description) ?? "",
    gold_leaves_cost: finiteNumber(item.gold_leaves_cost),
    max_inventory: finiteNumber(item.max_inventory),
    quantity: finiteNumber(item.quantity),
    can_purchase: item.can_purchase === true,
  };
};

const rewardMilestone = (
  gamificationValue: JsonRecord,
): RewardMilestone | null => {
  if (!Array.isArray(gamificationValue.recent_rewards)) return null;

  for (const candidate of gamificationValue.recent_rewards) {
    if (!isRecord(candidate)) continue;

    const inkDelta = finiteNumber(candidate.ink_delta);
    const goldLeavesDelta = finiteNumber(candidate.gold_leaves_delta);
    if (inkDelta <= 0 && goldLeavesDelta <= 0) continue;

    const id = optionalString(candidate.id);
    const title = optionalString(candidate.display_name);
    const eventType = optionalString(candidate.event_type);
    const earnedAt = optionalString(candidate.created_at);
    if (!id || !title || !eventType || !earnedAt) continue;

    return {
      kind: "reward",
      id,
      title,
      event_type: eventType,
      ink_delta: inkDelta,
      gold_leaves_delta: goldLeavesDelta,
      earned_at: earnedAt,
    };
  }

  return null;
};

const badgeMilestone = (dashboardValue: JsonRecord): BadgeMilestone | null => {
  if (!Array.isArray(dashboardValue.achievements)) return null;
  const badge = dashboardValue.achievements.find(isRecord);
  if (!badge) return null;

  const id = optionalString(badge.id);
  const title = optionalString(badge.title);
  const earnedAt = optionalString(badge.earned_at);
  if (!id || !title || !earnedAt) return null;

  return {
    kind: "badge",
    id,
    title,
    description: optionalString(badge.description),
    icon_url: optionalString(badge.icon_url),
    earned_at: earnedAt,
  };
};

export const selectLatestMilestone = (
  dashboardValue: JsonRecord,
  gamificationValue: JsonRecord,
): RewardMilestone | BadgeMilestone | null => {
  const reward = rewardMilestone(gamificationValue);
  const badge = badgeMilestone(dashboardValue);

  if (!reward) return badge;
  if (!badge) return reward;
  return timestampValue(badge.earned_at) > timestampValue(reward.earned_at)
    ? badge
    : reward;
};

export const buildJourneySummary = (
  dashboardValue: JsonRecord,
  gamificationValue: unknown,
  shopValue: unknown,
): DashboardJourneySummary => {
  if (!isRecord(gamificationValue)) {
    throw new Error("Invalid Journey response");
  }

  const account = gamificationValue.account;
  const quests = gamificationValue.quests;
  const tomorrowQuests = gamificationValue.tomorrow_quests;
  const recentRewards = gamificationValue.recent_rewards;
  const league = gamificationValue.league;
  const week = gamificationValue.week;

  if (
    !isRecord(account) ||
    !Array.isArray(quests) ||
    !Array.isArray(tomorrowQuests) ||
    !Array.isArray(recentRewards) ||
    !isRecord(week)
  ) {
    throw new Error("Invalid Journey response shape");
  }
  if (league !== null && league !== undefined && !isRecord(league)) {
    throw new Error("Invalid Journey league response");
  }

  return {
    account,
    quests,
    tomorrow_quests: tomorrowQuests,
    recent_rewards: recentRewards,
    league: isRecord(league) ? league : null,
    week,
    server_time: requiredString(gamificationValue, "server_time"),
    timezone: requiredString(gamificationValue, "timezone"),
    streak_freeze: extractStreakFreeze(shopValue),
    latest_milestone: selectLatestMilestone(dashboardValue, gamificationValue),
  };
};

export const buildDashboardHomeV2 = (
  dashboardValue: unknown,
  journey: DashboardJourneySummary | null,
  meta: Omit<DashboardHomeMeta, "schema_version">,
): JsonRecord & {
  journey: DashboardJourneySummary | null;
  meta: DashboardHomeMeta;
} => {
  if (!isRecord(dashboardValue)) {
    throw new Error("Invalid dashboard response shape");
  }

  return {
    ...dashboardValue,
    journey,
    meta: {
      schema_version: DASHBOARD_HOME_SCHEMA_VERSION,
      ...meta,
    },
  };
};

export const composeDashboardHomeV2 = (
  dashboardResult: DashboardRpcResult,
  gamificationResult: DashboardRpcResult,
  shopResult: DashboardRpcResult,
  servedAt: string,
): DashboardHomeComposition => {
  if (dashboardResult.error != null) throw dashboardResult.error;

  const dashboardValue = dashboardResult.data ?? {};
  const inventoryError: unknown = shopResult.error ?? null;
  let journeyError: unknown = gamificationResult.error ?? null;
  let journey: DashboardJourneySummary | null = null;

  if (journeyError == null) {
    try {
      journey = buildJourneySummary(
        dashboardValue as JsonRecord,
        gamificationResult.data,
        inventoryError == null ? shopResult.data : null,
      );
    } catch (error) {
      journeyError = error;
    }
  }

  return {
    response: buildDashboardHomeV2(dashboardValue, journey, {
      served_at: servedAt,
      journey_status: journeyError == null ? "ok" : "unavailable",
      inventory_status: inventoryError == null ? "ok" : "unavailable",
    }),
    journey_error: journeyError,
    inventory_error: inventoryError,
  };
};
