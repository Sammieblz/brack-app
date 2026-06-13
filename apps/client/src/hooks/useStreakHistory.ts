import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchStreakHistory as fetchStreakHistoryApi,
  type StreakMilestone,
} from "@/services/api";

export type { StreakMilestone } from "@/services/api";

export const useStreakHistory = (userId?: string) => {
  const [milestones, setMilestones] = useState<StreakMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchStreakHistory = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      setMilestones(await fetchStreakHistoryApi(userId));
    } catch (err: unknown) {
      console.error("Error fetching streak history:", err);
      setError(err instanceof Error ? err.message : "Failed to load streak history");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load streak history",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStreakHistory();
  }, [userId]);

  // Get milestone badges (7, 30, 100 days, etc.)
  const getMilestoneBadges = () => {
    const milestoneThresholds = [7, 30, 50, 100, 200, 365];
    return milestoneThresholds.map((threshold) => {
      const milestone = milestones.find((m) => m.streak_count >= threshold);
      return {
        threshold,
        achieved: !!milestone,
        achievedAt: milestone?.achieved_at || null,
      };
    });
  };

  // Get longest streak milestone
  const longestStreakMilestone = milestones.length > 0 
    ? milestones.reduce((longest, current) => 
        current.streak_count > longest.streak_count ? current : longest
      )
    : null;

  return {
    milestones,
    loading,
    error,
    refetch: fetchStreakHistory,
    getMilestoneBadges,
    longestStreakMilestone,
  };
};
