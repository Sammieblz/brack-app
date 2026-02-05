import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClubDiscussion } from "./useBookClubs";

export const useClubDiscussions = (clubId: string) => {
  const [discussions, setDiscussions] = useState<ClubDiscussion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDiscussions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('book_club_discussions')
        .select('*')
        .eq('club_id', clubId)
        .is('parent_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles for discussions
      const userIds = [...new Set(data?.map(d => d.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Fetch replies for each discussion
      const enrichedDiscussions = await Promise.all(
        (data || []).map(async (discussion) => {
          const { data: replies } = await supabase
            .from('book_club_discussions')
            .select('*')
            .eq('parent_id', discussion.id)
            .order('created_at', { ascending: true });

          const replyUserIds = [...new Set(replies?.map(r => r.user_id) || [])];
          const { data: replyProfiles } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', replyUserIds);

          const replyProfileMap = new Map(replyProfiles?.map(p => [p.id, p]) || []);

          return {
            ...discussion,
            user: profileMap.get(discussion.user_id),
            replies: replies?.map(reply => ({
              ...reply,
              user: replyProfileMap.get(reply.user_id),
            })) || [],
          };
        })
      );

      setDiscussions(enrichedDiscussions);
    } catch (error: unknown) {
      console.error('Error fetching discussions:', error);
      toast.error('Failed to load discussions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clubId) {
      fetchDiscussions();

      // Set up real-time subscription
      const channel = supabase
        .channel(`discussions-${clubId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'book_club_discussions',
            filter: `club_id=eq.${clubId}`,
          },
          () => {
            fetchDiscussions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [clubId]);

  const createDiscussion = async (data: {
    title?: string;
    content: string;
    parent_id?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('book_club_discussions')
        .insert({
          club_id: clubId,
          user_id: user.id,
          ...data,
        });

      if (error) throw error;

      toast.success(data.parent_id ? 'Reply posted!' : 'Discussion created!');
      await fetchDiscussions();
    } catch (error: unknown) {
      console.error('Error creating discussion:', error);
      toast.error('Failed to post');
      throw error;
    }
  };

  const deleteDiscussion = async (discussionId: string) => {
    try {
      const { error } = await supabase
        .from('book_club_discussions')
        .delete()
        .eq('id', discussionId);

      if (error) throw error;

      toast.success('Discussion deleted');
      await fetchDiscussions();
    } catch (error: unknown) {
      console.error('Error deleting discussion:', error);
      toast.error('Failed to delete');
      throw error;
    }
  };

  return {
    discussions,
    loading,
    fetchDiscussions,
    createDiscussion,
    deleteDiscussion,
  };
};
