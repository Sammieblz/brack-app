import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  fetchMessages as fetchMessagesApi,
  sendMessage as sendMessageApi,
  subscribeToMessages,
  type Message,
} from "@/services/api";

export type { Message } from "@/services/api";

export const useMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setMessages(await fetchMessagesApi(conversationId));
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

  const sendMessage = async (content: string) => {
    if (!conversationId) return false;

    try {
      await sendMessageApi(conversationId, content);

      return true;
    } catch (error: unknown) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
      return false;
    }
  };

  return { messages, loading, sendMessage, refetchMessages: fetchMessages };
};
