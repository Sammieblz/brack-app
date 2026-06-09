import { useState, useEffect } from "react";
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    if (!conversationId) {
      setMessages([]);
      setDetail(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const conversation = await fetchConversationDetail(conversationId);
      setDetail(conversation);
      setMessages(conversation.messages || []);
      const lastMessage = conversation.messages?.[conversation.messages.length - 1];
      await markConversationRead(conversationId, lastMessage?.id || null);
    } catch (error: unknown) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    if (!conversationId) return;

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
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cleanup?.();
    };
  }, [conversationId]);

  const sendMessage = async (contentOrRequest: string | Omit<SendMessageRequest, "conversation_id">) => {
    if (!conversationId) return false;

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

  return {
    messages,
    detail,
    loading,
    sendMessage,
    toggleReaction,
    deleteMessage,
    refetchMessages: fetchMessages,
  };
};
