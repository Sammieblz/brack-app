import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchFollowStats as fetchFollowStatsApi,
  followUser as followUserApi,
  unfollowUser as unfollowUserApi,
  subscribeToFollowRelationship,
  type FollowStats,
} from "@/services/api";

export const useFollowing = (userId: string | null) => {
  const [stats, setStats] = useState<FollowStats>({
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
    isFollowedBy: false,
    isMutual: false,
    messageEligibility: "restricted",
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchFollowStats = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setStats(await fetchFollowStatsApi(userId));
    } catch (error) {
      console.error("Error fetching follow stats:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFollowStats();
  }, [fetchFollowStats]);

  useEffect(() => {
    if (!user?.id || !userId || user.id === userId) return;
    return subscribeToFollowRelationship(user.id, userId, () => {
      void fetchFollowStats();
    });
  }, [fetchFollowStats, user?.id, userId]);

  const followUser = async () => {
    try {
      if (!userId) return;
      await followUserApi(userId);
      await fetchFollowStats();

      toast({
        title: "Success",
        description: "You are now following this user",
      });
    } catch (error: unknown) {
      console.error("Error following user:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to follow user",
        variant: "destructive",
      });
    }
  };

  const unfollowUser = async () => {
    try {
      if (!userId) return;
      await unfollowUserApi(userId);
      await fetchFollowStats();

      toast({
        title: "Success",
        description: "You unfollowed this user",
      });
    } catch (error: unknown) {
      console.error("Error unfollowing user:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to unfollow user",
        variant: "destructive",
      });
    }
  };

  return {
    ...stats,
    loading,
    followUser,
    unfollowUser,
    refetch: fetchFollowStats,
  };
};
