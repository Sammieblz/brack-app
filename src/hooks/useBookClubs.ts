import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  createBookClub,
  deleteBookClub,
  fetchBookClubs,
  joinBookClub,
  leaveBookClub,
  updateBookClub,
  type BookClub,
} from "@/services/api";

export type { BookClub, ClubMember, ClubDiscussion } from "@/services/api";

export const useBookClubs = () => {
  const [clubs, setClubs] = useState<BookClub[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClubs = async () => {
    try {
      setLoading(true);
      setClubs(await fetchBookClubs());
    } catch (error: unknown) {
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
      const data = await createBookClub(clubData);

      toast.success('Book club created successfully!');
      await fetchClubs();
      return data;
    } catch (error: unknown) {
      console.error('Error creating club:', error);
      toast.error('Failed to create book club');
      throw error;
    }
  };

  const joinClub = async (clubId: string) => {
    try {
      await joinBookClub(clubId);

      toast.success('Joined book club!');
      await fetchClubs();
    } catch (error: unknown) {
      console.error('Error joining club:', error);
      toast.error('Failed to join book club');
      throw error;
    }
  };

  const leaveClub = async (clubId: string) => {
    try {
      await leaveBookClub(clubId);

      toast.success('Left book club');
      await fetchClubs();
    } catch (error: unknown) {
      console.error('Error leaving club:', error);
      toast.error('Failed to leave book club');
      throw error;
    }
  };

  const updateClub = async (clubId: string, updates: Partial<BookClub>) => {
    try {
      await updateBookClub(clubId, updates);

      toast.success('Club updated successfully');
      await fetchClubs();
    } catch (error: unknown) {
      console.error('Error updating club:', error);
      toast.error('Failed to update club');
      throw error;
    }
  };

  const deleteClub = async (clubId: string) => {
    try {
      await deleteBookClub(clubId);

      toast.success('Club deleted successfully');
      await fetchClubs();
    } catch (error: unknown) {
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
