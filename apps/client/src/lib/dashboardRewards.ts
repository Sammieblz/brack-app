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

/**
 * Compares a newest-first reward window with the persisted cursor. When the
 * cursor has fallen outside the server window, every returned reward is new.
 */
export const observeDashboardRewards = (
  rewards: DashboardRewardDelta[],
  previousId: string | null,
): DashboardRewardObservation => {
  const earnings = rewards.filter(
    (reward) => reward.ink_delta > 0 || reward.gold_leaves_delta > 0,
  );
  const newestId = earnings[0]?.id ?? null;
  if (!newestId) return { newestId: null, confirmed: [], initializesCursor: false };
  if (!previousId) return { newestId, confirmed: [], initializesCursor: true };
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
