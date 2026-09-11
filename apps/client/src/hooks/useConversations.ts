import { getApiErrorStatus } from "@/services/api/client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  fetchConversations as fetchConversationsApi,
  getOrCreateConversation as getOrCreateConversationApi,
  subscribeToConversationChanges,
  type Conversation,
} from "@/services/api";

export type { Conversation } from "@/services/api";

export const useConversations = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedUser, setLoadedUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const fetchConversations = useCallback(async () => {
    if (!userId) return;
    const requestId = ++request.current;
    try {
      setLoading(true);
      setError(null);
      const result = await fetchConversationsApi();
      if (activeUser.current !== userId || request.current !== requestId) return;
      setConversations(result);
      setLoadedUser(userId);
    } catch (error: unknown) {
      if (activeUser.current !== userId || request.current !== requestId) return;
      if ([401, 403, 404].includes(getApiErrorStatus(error) ?? 0)) { setConversations([]); setLoadedUser(null); }
      console.error("Error fetching conversations:", error);
      toast.error("Failed to load conversations");
      setError("We couldn't load conversations. Please try again.");
    } finally {
      if (activeUser.current === userId && request.current === requestId) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoadedUser(null);
    setConversations([]);
    setError(null);
    setLoading(Boolean(userId));
    if (!userId) return;
    void fetchConversations();

    return subscribeToConversationChanges(fetchConversations);
  }, [userId, fetchConversations]);

  const getOrCreateConversation = useCallback(async (otherUserId: string): Promise<string | null> => {
    try {
      const conversationId = await getOrCreateConversationApi(otherUserId);
      await fetchConversations();
      return conversationId;
    } catch (error: unknown) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to start conversation");
      return null;
    }
  }, [fetchConversations]);

  const hasLoaded = Boolean(userId && loadedUser === userId);
  return { conversations: hasLoaded ? conversations : [], loading, hasLoaded, error, refetchConversations: fetchConversations, getOrCreateConversation };
};
