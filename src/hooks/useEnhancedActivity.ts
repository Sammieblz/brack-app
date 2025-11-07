import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Activity {
  id: string;
  type: 'book_completed' | 'book_started' | 'progress_logged' | 'reading_session';
  description: string;
  timestamp: string;
  book?: {
    id: string;
    title: string;
    author?: string;
    cover_url?: string;
  };
  details?: any;
}

export const useEnhancedActivity = (limit: number = 20) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const fetchActivity = async (offset: number = 0) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('enhanced-activity', {
        body: { limit, offset },
      });

      if (error) throw error;
      
      if (offset === 0) {
        setActivities(data.activities || []);
      } else {
        setActivities(prev => [...prev, ...(data.activities || [])]);
      }
      
      setHasMore(data.has_more || false);
    } catch (error) {
      console.error('Error fetching enhanced activity:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, [limit]);

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchActivity(activities.length);
    }
  };

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
    hasMore,
    loadMore,
    formatTimeAgo,
    refetchActivity: () => fetchActivity(0),
  };
};
