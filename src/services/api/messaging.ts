import { supabase } from "@/integrations/supabase/client";
import { sanitizeInput } from "@/utils/sanitize";
import { getCurrentAuthUser } from "./auth";

export interface Conversation {
  id: string;
  participant_one_id: string;
  participant_two_id: string;
  created_at: string;
  updated_at: string;
  other_user?: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
  };
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export const fetchConversations = async (): Promise<Conversation[]> => {
  const user = await getCurrentAuthUser();
  if (!user) return [];

  const { data: convData, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`participant_one_id.eq.${user.id},participant_two_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return Promise.all(
    (convData || []).map(async (conv) => {
      const otherUserId =
        conv.participant_one_id === user.id
          ? conv.participant_two_id
          : conv.participant_one_id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", otherUserId)
        .single();

      const { data: lastMsg } = await supabase
        .from("messages")
        .select("content, created_at, sender_id")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .eq("is_read", false)
        .neq("sender_id", user.id);

      return {
        ...conv,
        other_user: profile || undefined,
        last_message: lastMsg || undefined,
        unread_count: count || 0,
      };
    })
  );
};

export const getOrCreateConversation = async (
  otherUserId: string
): Promise<string | null> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(participant_one_id.eq.${user.id},participant_two_id.eq.${otherUserId}),and(participant_one_id.eq.${otherUserId},participant_two_id.eq.${user.id})`
    )
    .single();

  if (existing) return existing.id;

  const { data: newConv, error } = await supabase
    .from("conversations")
    .insert({
      participant_one_id: user.id,
      participant_two_id: otherUserId,
    })
    .select()
    .single();

  if (error) throw error;
  return newConv.id;
};

export const fetchMessages = async (
  conversationId: string
): Promise<Message[]> => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const user = await getCurrentAuthUser();
  if (user) {
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .eq("is_read", false);
  }

  return data || [];
};

export const sendMessage = async (
  conversationId: string,
  content: string
): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    content: sanitizeInput(content),
  });

  if (error) throw error;
};

export const createMessageRecord = async (
  data: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabase.from("messages").insert(data);

  if (error) throw error;
};

export const deleteConversation = async (
  conversationId: string
): Promise<void> => {
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId);

  if (error) throw error;
};

export const markConversationRead = async (
  conversationId: string,
  currentUserId?: string
): Promise<void> => {
  let query = supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId);

  if (currentUserId) {
    query = query.neq("sender_id", currentUserId);
  }

  const { error } = await query;
  if (error) throw error;
};

export const subscribeToConversationChanges = (
  onChange: () => void
): (() => void) => {
  const channel = supabase
    .channel("conversations-changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversations",
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToMessages = (
  conversationId: string,
  onChange: () => void
): (() => void) => {
  const channel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

interface TypingState {
  userId: string;
  isTyping: boolean;
  timestamp: number;
}

export interface TypingIndicatorSubscription {
  setTyping: (isTyping: boolean) => Promise<void>;
  cleanup: () => void;
}

export const subscribeToTypingIndicator = (
  conversationId: string,
  currentUserId: string,
  onOtherUserTypingChange: (isTyping: boolean) => void
): TypingIndicatorSubscription => {
  const channel = supabase.channel(`typing:${conversationId}`, {
    config: {
      presence: {
        key: currentUserId,
      },
    },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<TypingState>();
      const typingUsers = Object.values(state).flat();
      const someoneTyping = typingUsers.some(
        (user) => user.userId !== currentUserId && user.isTyping
      );
      onOtherUserTypingChange(someoneTyping);
    })
    .subscribe();

  return {
    setTyping: async (isTyping: boolean) => {
      await channel.track({
        userId: currentUserId,
        isTyping,
        timestamp: Date.now(),
      });
    },
    cleanup: () => {
      supabase.removeChannel(channel);
    },
  };
};
