import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

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
      const currentUser = (await supabase.auth.getUser()).data.user;

      // Get followers count
      const { count: followersCount } = await supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId);

      // Get following count
      const { count: followingCount } = await supabase
        .from("user_follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId);

      // Check if current user is following this user
      let isFollowing = false;
      if (currentUser) {
        const { data } = await supabase
          .from("user_follows")
          .select("id")
          .eq("follower_id", currentUser.id)
          .eq("following_id", userId)
          .maybeSingle();

        isFollowing = !!data;
      }

      setStats({
        followersCount: followersCount || 0,
        followingCount: followingCount || 0,
        isFollowing,
      });
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
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser || !userId) return;

      const { error } = await supabase.from("user_follows").insert({
        follower_id: currentUser.id,
        following_id: userId,
      });

      if (error) throw error;

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
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser || !userId) return;

      const { error } = await supabase
        .from("user_follows")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", userId);

      if (error) throw error;

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
