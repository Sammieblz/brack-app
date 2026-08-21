export interface DashboardRewardDelta {
  id: string;
  ink_delta: number;
  gold_leaves_delta: number;
}

export interface DashboardRewardObservation {
  newestId: string | null;
  confirmed: DashboardRewardDelta[];
  initializesCursor: boolean;
}

export interface DashboardRewardSummary {
  rewardCount: number;
  ink: number;
  goldLeaves: number;
}

const positiveRewardAmount = (value: number) => (
  Number.isFinite(value) ? Math.max(0, value) : 0
);

interface ObserveDashboardRewardsOptions {
  /** True after this browser session has already observed an empty reward window. */
  hasObservedWindow?: boolean;
}

export const summarizeDashboardRewards = (
  rewards: readonly DashboardRewardDelta[],
): DashboardRewardSummary => rewards.reduce<DashboardRewardSummary>(
  (summary, reward) => {
    const ink = positiveRewardAmount(reward.ink_delta);
    const goldLeaves = positiveRewardAmount(reward.gold_leaves_delta);
    if (ink === 0 && goldLeaves === 0) return summary;
    return {
      rewardCount: summary.rewardCount + 1,
      ink: summary.ink + ink,
      goldLeaves: summary.goldLeaves + goldLeaves,
    };
  },
  { rewardCount: 0, ink: 0, goldLeaves: 0 },
);

/**
 * Compares a newest-first reward window with the persisted cursor. When the
 * cursor has fallen outside the server window, every returned reward is new.
 */
export const observeDashboardRewards = (
  rewards: readonly DashboardRewardDelta[],
  previousId: string | null,
  options: ObserveDashboardRewardsOptions = {},
): DashboardRewardObservation => {
  const earnings = rewards.filter(
    (reward) => reward.ink_delta > 0 || reward.gold_leaves_delta > 0,
  );
  const newestId = earnings[0]?.id ?? null;
  if (!newestId) return { newestId: null, confirmed: [], initializesCursor: false };
  if (!previousId) {
    return options.hasObservedWindow
      ? { newestId, confirmed: earnings, initializesCursor: false }
      : { newestId, confirmed: [], initializesCursor: true };
  }
  if (previousId === newestId) {
    return { newestId, confirmed: [], initializesCursor: false };
  }

  const previousIndex = earnings.findIndex((reward) => reward.id === previousId);
  return {
    newestId,
    confirmed: previousIndex > 0 ? earnings.slice(0, previousIndex) : earnings,
    initializesCursor: false,
  };
};
