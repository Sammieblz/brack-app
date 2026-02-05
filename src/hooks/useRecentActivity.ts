import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RecentActivity {
  id: string;
  type: 'book_completed' | 'book_started' | 'reading_session' | 'goal_set';
  description: string;
  timestamp: string;
  book_title?: string;
}

export const useRecentActivity = (userId?: string) => {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentActivity = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const activities: RecentActivity[] = [];

      // Get recent book status changes (completed books)
      const { data: completedBooks } = await supabase
        .from('books')
        .select('id, title, updated_at, status')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (completedBooks) {
        completedBooks.forEach(book => {
          activities.push({
            id: `book-completed-${book.id}`,
            type: 'book_completed',
            description: `Completed reading "${book.title}"`,
            timestamp: book.updated_at,
            book_title: book.title
          });
        });
      }

      // Get recent reading sessions
      const { data: sessions } = await supabase
        .from('reading_sessions')
        .select(`
          id,
          created_at,
          duration,
          books (title)
        `)
        .eq('user_id', userId)
        .not('duration', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (sessions) {
        sessions.forEach(session => {
          const bookTitle = (session as { books?: { title?: string } }).books?.title || 'Unknown Book';
          const duration = Math.round((session.duration || 0) / 60); // Convert to minutes
          activities.push({
            id: `session-${session.id}`,
            type: 'reading_session',
            description: `Read "${bookTitle}" for ${duration} minutes`,
            timestamp: session.created_at,
            book_title: bookTitle
          });
        });
      }

      // Get recent goals
      const { data: goals } = await supabase
        .from('goals')
        .select('id, created_at, target_books')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (goals) {
        goals.forEach(goal => {
          activities.push({
            id: `goal-${goal.id}`,
            type: 'goal_set',
            description: `Set reading goal: ${goal.target_books} books`,
            timestamp: goal.created_at
          });
        });
      }

      // Sort all activities by timestamp and take the most recent 10
      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      setActivities(sortedActivities);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivity();
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