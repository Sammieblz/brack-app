import { useEffect, useState } from "react";
import {
  subscribeToTypingIndicator,
  type TypingIndicatorSubscription,
} from "@/services/api";

export const useTypingIndicator = (conversationId: string | null, currentUserId: string | undefined) => {
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [typingSubscription, setTypingSubscription] =
    useState<TypingIndicatorSubscription | null>(null);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const subscription = subscribeToTypingIndicator(
      conversationId,
      currentUserId,
      setOtherUserTyping
    );
    setTypingSubscription(subscription);

    return () => {
      subscription.cleanup();
    };
  }, [conversationId, currentUserId]);

  const setTyping = async (isTyping: boolean) => {
    await typingSubscription?.setTyping(isTyping);
  };

  return {
    otherUserTyping,
    setTyping,
  };
};
