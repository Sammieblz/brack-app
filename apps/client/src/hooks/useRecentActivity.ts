import { useState, useEffect } from "react";
import {
  fetchRecentActivity as fetchRecentActivityApi,
  type RecentActivity,
} from "@/services/api";

export type { RecentActivity } from "@/services/api";

export const useRecentActivity = (userId?: string) => {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentActivity = async () => {
    if (!userId) {
      setActivities([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setActivities(await fetchRecentActivityApi(userId));
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRecentActivity();
  }, [userId]);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) {
      return diffInMinutes === 0 ? 'Just now' : `${diffInMinutes} minutes ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  };

  return {
    activities,
    loading,
    formatTimeAgo,
    refetchActivity: fetchRecentActivity
  };
};
