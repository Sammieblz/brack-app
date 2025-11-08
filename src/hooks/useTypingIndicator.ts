import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface TypingState {
  userId: string;
  isTyping: boolean;
  timestamp: number;
}

export const useTypingIndicator = (conversationId: string | null, currentUserId: string | undefined) => {
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const typingChannel = supabase.channel(`typing:${conversationId}`, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    typingChannel
      .on("presence", { event: "sync" }, () => {
        const state = typingChannel.presenceState<TypingState>();
        const typingUsers = Object.values(state).flat();
        
        // Check if any other user is typing
        const someoneTyping = typingUsers.some(
          (user) => user.userId !== currentUserId && user.isTyping
        );
        setOtherUserTyping(someoneTyping);
      })
      .subscribe();

    setChannel(typingChannel);

    return () => {
      supabase.removeChannel(typingChannel);
    };
  }, [conversationId, currentUserId]);

  const setTyping = async (isTyping: boolean) => {
    if (!channel || !currentUserId) return;

    await channel.track({
      userId: currentUserId,
      isTyping,
      timestamp: Date.now(),
    });
  };

  return {
    otherUserTyping,
    setTyping,
  };
};
