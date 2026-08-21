import type {
  GamificationAccount,
  LeaderboardEntry,
} from "@/services/api/gamification";

export const calculateInkLevelProgress = (
  account: GamificationAccount | null | undefined,
) => {
  if (!account) return 0;
  if (!account.next_level) return 100;
  const span = Math.max(
    1,
    account.next_level.ink_threshold - account.level_threshold,
  );
  return Math.min(
    100,
    Math.max(
      0,
      ((account.lifetime_ink - account.level_threshold) / span) * 100,
    ),
  );
};

export const compareLeaderboardEntries = (
  left: LeaderboardEntry,
  right: LeaderboardEntry,
) =>
  right.competitive_ink - left.competitive_ink
  || right.quests_completed - left.quests_completed
  || right.qualifying_minutes - left.qualifying_minutes
  || right.reading_days - left.reading_days
  || left.rank - right.rank;

export const questProgressPercent = (
  progressValue: number,
  targetValue: number,
) => {
  if (targetValue <= 0) return 0;
  return Math.min(100, Math.max(0, (progressValue / targetValue) * 100));
};
