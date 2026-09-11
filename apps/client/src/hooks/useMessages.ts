import { getApiErrorStatus } from "@/services/api/client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  fetchConversationDetail,
  markConversationRead,
  sendMessage as sendMessageApi,
  subscribeToMessages,
  toggleMessageReaction as toggleMessageReactionApi,
  deleteMessage as deleteMessageApi,
  type ConversationDetail,
  type Message,
  type MessageReactionType,
  type SendMessageRequest,
} from "@/services/api";

export type { Message, MessageReactionType, SendMessageRequest } from "@/services/api";

export const useMessages = (conversationId: string | null) => {
  const { user } = useAuth();
  const identity = user?.id && conversationId ? `${user.id}:${conversationId}` : null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [loadedIdentity, setLoadedIdentity] = useState<string | null>(null);
  const activeIdentity = useRef(identity);
  activeIdentity.current = identity;
  const request = useRef(0);

  const fetchMessages = useCallback(async () => {
    if (activeIdentity.current !== identity) return;
    if (!identity || !conversationId) {
      setMessages([]);
      setDetail(null);
      setLoadedIdentity(null);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++request.current;
    try {
      setLoading(true);
      setError(null);
      const conversation = await fetchConversationDetail(conversationId);
      if (activeIdentity.current !== identity || request.current !== requestId) return;
      setDetail(conversation);
      setLoadedIdentity(identity);
      setMessages(conversation.messages || []);
      const lastMessage = conversation.messages?.[conversation.messages.length - 1];
      await markConversationRead(conversationId, lastMessage?.id || null);
    } catch (error: unknown) {
      if (activeIdentity.current !== identity || request.current !== requestId) return;
      if ([401, 403, 404].includes(getApiErrorStatus(error) ?? 0)) { setMessages([]); setDetail(null); setLoadedIdentity(null); }
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
      setError("We couldn't load this conversation. Please try again.");
      setErrorId(identity);
    } finally {
      if (activeIdentity.current === identity && request.current === requestId) setLoading(false);
    }
  }, [conversationId, identity]);

  useEffect(() => {
    setMessages([]);
    setDetail(null);
    setLoadedIdentity(null);
    setError(null);
    setErrorId(null);
    void fetchMessages();

    if (!identity || !conversationId) return () => { request.current += 1; };

    // Only subscribe to real-time updates if page is visible
    // This reduces battery drain when app is in background
    let cleanup: (() => void) | null = null;

    const setupSubscription = () => {
      if (document.hidden) return; // Don't subscribe if page is hidden

      cleanup = subscribeToMessages(conversationId, fetchMessages);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page hidden - unsubscribe to save battery
        if (cleanup) {
          cleanup();
          cleanup = null;
        }
      } else {
        // Page visible - subscribe
        setupSubscription();
      }
    };

    setupSubscription();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      request.current += 1;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup?.();
    };
  }, [conversationId, identity, fetchMessages]);

  const sendMessage = async (contentOrRequest: string | Omit<SendMessageRequest, "conversation_id">) => {
    if (!identity || !conversationId || activeIdentity.current !== identity) return false;

    try {
      const request =
        typeof contentOrRequest === "string"
          ? contentOrRequest
          : {
              ...contentOrRequest,
              conversation_id: conversationId,
            };
      const message = await sendMessageApi(
        typeof request === "string" ? conversationId : request,
        typeof request === "string" ? request : undefined
      );
      if (activeIdentity.current !== identity) return true;
      setMessages((current) => [...current, message]);
      window.dispatchEvent(new Event("messages-changed"));
      return true;
    } catch (error: unknown) {
      console.error("Error sending message:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send message");
      return false;
    }
  };

  const toggleReaction = async (messageId: string, reactionType: MessageReactionType) => {
    try {
      const result = await toggleMessageReactionApi(messageId, reactionType);
      if (activeIdentity.current !== identity) return true;
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? result.message : message))
      );
      return true;
    } catch (error) {
      console.error("Error reacting to message:", error);
      toast.error("Failed to update reaction");
      return false;
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await deleteMessageApi(messageId);
      if (activeIdentity.current !== identity) return true;
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, content: null, media: [], deleted_at: new Date().toISOString() }
            : message
        )
      );
      window.dispatchEvent(new Event("messages-changed"));
      return true;
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Failed to delete message");
      return false;
    }
  };

  const hasLoaded = Boolean(identity && loadedIdentity === identity && detail?.conversation.id === conversationId);
  return {
    messages: hasLoaded ? messages : [],
    detail: hasLoaded ? detail : null,
    loading: Boolean(identity && (loading || (!hasLoaded && errorId !== identity))),
    hasLoaded,
    error: errorId === identity ? error : null,
    sendMessage,
    toggleReaction,
    deleteMessage,
    refetchMessages: fetchMessages,
  };
};
