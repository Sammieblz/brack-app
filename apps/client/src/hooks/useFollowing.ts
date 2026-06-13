import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  fetchFollowStats as fetchFollowStatsApi,
  followUser as followUserApi,
  unfollowUser as unfollowUserApi,
  type FollowStats,
} from "@/services/api";

export const useFollowing = (userId: string | null) => {
  const [stats, setStats] = useState<FollowStats>({
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchFollowStats = async () => {
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
  };

  useEffect(() => {
    fetchFollowStats();
  }, [userId]);

  const followUser = async () => {
    try {
      if (!userId) return;
      await followUserApi(userId);

      setStats((prev) => ({
        ...prev,
        followersCount: prev.followersCount + 1,
        isFollowing: true,
      }));

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

      setStats((prev) => ({
        ...prev,
        followersCount: prev.followersCount - 1,
        isFollowing: false,
      }));

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
