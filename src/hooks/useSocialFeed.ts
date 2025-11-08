import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeedActivity {
  id: string;
  user_id: string;
  activity_type: 'book_started' | 'book_completed' | 'book_reviewed' | 'followed_user' | 'created_list' | 'earned_badge';
  book_id?: string;
  review_id?: string;
  list_id?: string;
  badge_id?: string;
  metadata?: any;
  visibility: string;
  created_at: string;
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
  book?: {
    id: string;
    title: string;
    author?: string;
    cover_url?: string;
  };
}

export const useSocialFeed = (limit: number = 20) => {
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  const fetchFeed = async (offset: number = 0) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('social-feed', {
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
      console.error('Error fetching social feed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();

    // Set up real-time subscription for new activities
    const channel = supabase
      .channel('social-feed-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'social_activities'
        },
        (payload) => {
          console.log('New activity detected:', payload);
          // Refetch feed to get enriched activity data
          fetchFeed(0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit]);

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchFeed(activities.length);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Just now';
    }
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
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
    if (diffInWeeks < 4) {
      return `${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
  };

  return {
    activities,
    loading,
    hasMore,
    loadMore,
    formatTimeAgo,
    refetchFeed: () => fetchFeed(0),
  };
};
