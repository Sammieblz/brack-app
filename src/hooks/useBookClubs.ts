import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BookClub {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  current_book_id?: string;
  cover_image_url?: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
  user_role?: string;
  current_book?: {
    id: string;
    title: string;
    author?: string;
    cover_url?: string;
  };
}

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
}

export interface ClubDiscussion {
  id: string;
  club_id: string;
  user_id: string;
  title?: string;
  content: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
  replies?: ClubDiscussion[];
}

export const useBookClubs = () => {
  const [clubs, setClubs] = useState<BookClub[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClubs = async () => {
    try {
      setLoading(true);
      const { data: clubsData, error: clubsError } = await supabase
        .from('book_clubs')
        .select('*')
        .order('created_at', { ascending: false });

      if (clubsError) throw clubsError;

      // Fetch member counts and user roles for each club
      const enrichedClubs = await Promise.all(
        (clubsData || []).map(async (club) => {
          const { count } = await supabase
            .from('book_club_members')
            .select('*', { count: 'exact', head: true })
            .eq('club_id', club.id);

          const { data: { user } } = await supabase.auth.getUser();
          let userRole = null;

          if (user) {
            const { data: memberData } = await supabase
              .from('book_club_members')
              .select('role')
              .eq('club_id', club.id)
              .eq('user_id', user.id)
              .single();

            userRole = memberData?.role;
          }

          // Fetch current book if exists
          let currentBook = null;
          if (club.current_book_id) {
            const { data: bookData } = await supabase
              .from('books')
              .select('id, title, author, cover_url')
              .eq('id', club.current_book_id)
              .single();
            
            currentBook = bookData;
          }

          return {
            ...club,
            member_count: count || 0,
            user_role: userRole,
            current_book: currentBook,
          };
        })
      );

      setClubs(enrichedClubs);
    } catch (error: any) {
      console.error('Error fetching clubs:', error);
      toast.error('Failed to load book clubs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
  }, []);

  const createClub = async (clubData: {
    name: string;
    description?: string;
    is_private?: boolean;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('book_clubs')
        .insert({
          ...clubData,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Book club created successfully!');
      await fetchClubs();
      return data;
    } catch (error: any) {
      console.error('Error creating club:', error);
      toast.error('Failed to create book club');
      throw error;
    }
  };

  const joinClub = async (clubId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('book_club_members')
        .insert({
          club_id: clubId,
          user_id: user.id,
          role: 'member',
        });

      if (error) throw error;

      toast.success('Joined book club!');
      await fetchClubs();
    } catch (error: any) {
      console.error('Error joining club:', error);
      toast.error('Failed to join book club');
      throw error;
    }
  };

  const leaveClub = async (clubId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('book_club_members')
        .delete()
        .eq('club_id', clubId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Left book club');
      await fetchClubs();
    } catch (error: any) {
      console.error('Error leaving club:', error);
      toast.error('Failed to leave book club');
      throw error;
    }
  };

  const updateClub = async (clubId: string, updates: Partial<BookClub>) => {
    try {
      const { error } = await supabase
        .from('book_clubs')
        .update(updates)
        .eq('id', clubId);

      if (error) throw error;

      toast.success('Club updated successfully');
      await fetchClubs();
    } catch (error: any) {
      console.error('Error updating club:', error);
      toast.error('Failed to update club');
      throw error;
    }
  };

  const deleteClub = async (clubId: string) => {
    try {
      const { error } = await supabase
        .from('book_clubs')
        .delete()
        .eq('id', clubId);

      if (error) throw error;

      toast.success('Club deleted successfully');
      await fetchClubs();
    } catch (error: any) {
      console.error('Error deleting club:', error);
      toast.error('Failed to delete club');
      throw error;
    }
  };

  return {
    clubs,
    loading,
    fetchClubs,
    createClub,
    joinClub,
    leaveClub,
    updateClub,
    deleteClub,
  };
};
