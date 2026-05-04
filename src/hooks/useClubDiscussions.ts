import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ClubDiscussion } from "./useBookClubs";
import {
  createClubDiscussion,
  deleteClubDiscussion as deleteClubDiscussionApi,
  fetchClubDiscussions,
  subscribeToClubDiscussions,
} from "@/services/api";

export const useClubDiscussions = (clubId: string) => {
  const [discussions, setDiscussions] = useState<ClubDiscussion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDiscussions = async () => {
    try {
      setLoading(true);
      setDiscussions(await fetchClubDiscussions(clubId));
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

      return subscribeToClubDiscussions(clubId, fetchDiscussions);
    }
  }, [clubId]);

  const createDiscussion = async (data: {
    title?: string;
    content: string;
    parent_id?: string;
  }) => {
    try {
      await createClubDiscussion(clubId, data);

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
      await deleteClubDiscussionApi(discussionId);

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
