import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  fetchConversations as fetchConversationsApi,
  getOrCreateConversation as getOrCreateConversationApi,
  subscribeToConversationChanges,
  type Conversation,
} from "@/services/api";

export type { Conversation } from "@/services/api";

export const useConversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      setConversations(await fetchConversationsApi());
    } catch (error: unknown) {
      console.error("Error fetching conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();

    return subscribeToConversationChanges(fetchConversations);
  }, []);

  const getOrCreateConversation = async (otherUserId: string): Promise<string | null> => {
    try {
      const conversationId = await getOrCreateConversationApi(otherUserId);
      await fetchConversations();
      return conversationId;
    } catch (error: unknown) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to start conversation");
      return null;
    }
  };

  return { conversations, loading, refetchConversations: fetchConversations, getOrCreateConversation };
};
