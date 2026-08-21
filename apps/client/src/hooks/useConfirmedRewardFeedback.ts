import { useLayoutEffect, useRef } from "react";
import { useRewardFeedback, type ConfirmedRewardFeedbackBatch } from "@/contexts/RewardFeedbackContext";
import {
  observeDashboardRewards,
  summarizeDashboardRewards,
  type DashboardRewardDelta,
} from "@/lib/dashboardRewards";
import type {
  DashboardExperienceSource,
  DashboardJourneyFreshness,
} from "@/services/api/dashboard";

export interface ConfirmedRewardFeedbackOptions {
  userId?: string;
  rewards?: readonly DashboardRewardDelta[];
  fallbackReward?: DashboardRewardDelta | null;
  source: DashboardExperienceSource | null;
  freshness: DashboardJourneyFreshness;
  provisional: boolean;
  hasCurrentSessionLiveResponse: boolean;
  /** Hold confirmed feedback while a higher-priority celebration is visible. */
  blocked?: boolean;
}

interface RewardSessionCursor {
  userId?: string;
  newestId: string | null;
  hasObservedWindow: boolean;
}

const mergeBatches = (
  current: ConfirmedRewardFeedbackBatch | null,
  next: ConfirmedRewardFeedbackBatch,
): ConfirmedRewardFeedbackBatch => current
  ? {
      id: next.id,
      userId: next.userId,
      rewardCount: current.rewardCount + next.rewardCount,
      ink: current.ink + next.ink,
      goldLeaves: current.goldLeaves + next.goldLeaves,
    }
  : next;

const canPresentRewardFeedback = () => (
  typeof document !== "undefined"
  && document.visibilityState === "visible"
  && document.hasFocus()
);

/**
 * Publishes only positive ledger deltas observed after this hook has received a
 * live response in the current browser session. localStorage is write-only: a
 * persisted cursor can never cause a reward animation on a cold load.
 */
export const useConfirmedRewardFeedback = ({
  userId,
  rewards,
  fallbackReward,
  source,
  freshness,
  provisional,
  hasCurrentSessionLiveResponse,
  blocked = false,
}: ConfirmedRewardFeedbackOptions) => {
  const { publishConfirmedRewards } = useRewardFeedback();
  const cursorRef = useRef<RewardSessionCursor>({
    userId,
    newestId: null,
    hasObservedWindow: false,
  });
  const pendingRef = useRef<ConfirmedRewardFeedbackBatch | null>(null);

  if (cursorRef.current.userId !== userId) {
    cursorRef.current = { userId, newestId: null, hasObservedWindow: false };
    pendingRef.current = null;
  }

  useLayoutEffect(() => {
    const publishPending = () => {
      const pending = pendingRef.current;
      if (!pending || blocked) return;
      pendingRef.current = null;
      if (canPresentRewardFeedback()) publishConfirmedRewards(pending);
    };

    if (!userId) return;
    const isServerConfirmed = hasCurrentSessionLiveResponse
      && source === "live"
      && freshness === "live"
      && !provisional;
    if (!isServerConfirmed) {
      publishPending();
      return;
    }

    const rewardWindow = rewards?.length
      ? rewards
      : fallbackReward
        ? [fallbackReward]
        : [];
    const cursor = cursorRef.current;
    const observation = observeDashboardRewards(
      rewardWindow,
      cursor.newestId,
      { hasObservedWindow: cursor.hasObservedWindow },
    );
    cursor.hasObservedWindow = true;

    if (observation.newestId) {
      cursor.newestId = observation.newestId;
      try {
        localStorage.setItem(
          `brack:journey:last-seen-reward:${userId}`,
          observation.newestId,
        );
      } catch {
        // The in-memory session cursor still prevents render-time replay.
      }
    }

    const summary = summarizeDashboardRewards(observation.confirmed);
    if (summary.rewardCount > 0 && observation.newestId) {
      pendingRef.current = mergeBatches(pendingRef.current, {
        userId,
        id: observation.newestId,
        ...summary,
      });
    }
    publishPending();
  }, [
    blocked,
    fallbackReward,
    freshness,
    hasCurrentSessionLiveResponse,
    provisional,
    publishConfirmedRewards,
    rewards,
    source,
    userId,
  ]);
};
