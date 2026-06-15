import { useEffect, useState } from "react";
import {
  subscribeToClubChatTypingIndicator,
  type ClubChatTypingSubscription,
  type ClubChatTypingUser,
} from "@/services/api";

interface CurrentTypingUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export const useClubChatTypingIndicator = (
  clubId: string | null,
  currentUser: CurrentTypingUser | null
) => {
  const [typingUsers, setTypingUsers] = useState<ClubChatTypingUser[]>([]);
  const [subscription, setSubscription] = useState<ClubChatTypingSubscription | null>(null);
  const currentUserId = currentUser?.id ?? null;
  const currentUserName = currentUser?.name ?? "";
  const currentUserAvatarUrl = currentUser?.avatarUrl ?? null;

  useEffect(() => {
    if (!clubId || !currentUserId) {
      setTypingUsers([]);
      return;
    }

    const clubSubscription = subscribeToClubChatTypingIndicator(
      clubId,
      {
        id: currentUserId,
        name: currentUserName,
        avatarUrl: currentUserAvatarUrl,
      },
      setTypingUsers
    );
    setSubscription(clubSubscription);

    return () => {
      void clubSubscription.setTyping(false);
      clubSubscription.cleanup();
      setSubscription(null);
      setTypingUsers([]);
    };
  }, [clubId, currentUserAvatarUrl, currentUserId, currentUserName]);

  const setTyping = async (isTyping: boolean) => {
    await subscription?.setTyping(isTyping);
  };

  return { typingUsers, setTyping };
};
