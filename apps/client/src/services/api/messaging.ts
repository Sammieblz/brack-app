import { supabase } from "@/integrations/supabase/client";
import { sanitizeInput } from "@/utils/sanitize";
import { getCurrentAuthUser } from "./auth";
import { invokeFunction } from "./client";
import { withContentSnapshot } from "@/services/contentSnapshots";

export type MessageType = "text" | "media" | "gif";
export type MessageReactionType = "like" | "dislike" | "heart" | "laugh" | "wow" | "thanks";
export type MessageMediaSource = "upload" | "tenor";
export type MessageMediaType = "image" | "gif";

export interface ConversationUser {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
  show_online_status?: boolean | null;
  last_seen_at?: string | null;
  reader_status?: string | null;
}

export interface ConversationSettings {
  conversation_id: string;
  user_id: string;
  is_muted: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  hidden_at?: string | null;
  last_opened_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ConversationSummary {
  id: string;
  participant_one_id: string;
  participant_two_id: string;
  created_at: string;
  updated_at: string;
  other_user?: ConversationUser | null;
  last_message?: {
    id: string;
    content: string | null;
    message_type: MessageType;
    created_at: string;
    sender_id: string;
    deleted_at?: string | null;
    media_count?: number;
  } | null;
  unread_count?: number;
  settings?: ConversationSettings | null;
  is_blocked?: boolean;
}

export interface MessageMedia {
  id?: string;
  message_id?: string;
  conversation_id?: string;
  user_id?: string;
  media_source: MessageMediaSource;
  media_type: MessageMediaType;
  bucket_id?: string;
  storage_path?: string | null;
  external_url?: string | null;
  signed_url?: string | null;
  preview_url?: string | null;
  provider?: string | null;
  provider_id?: string | null;
  mime_type: string;
  size_bytes?: number | null;
  width?: number | null;
  height?: number | null;
  position?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  conversation_id: string;
  user_id: string;
  reaction_type: MessageReactionType;
  created_at: string;
  updated_at?: string;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: MessageType;
  is_read?: boolean | null;
  reply_to_message_id?: string | null;
  client_message_id?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
  media?: MessageMedia[];
  reactions?: MessageReaction[];
  reaction_counts?: Partial<Record<MessageReactionType, number>>;
  current_user_reaction?: MessageReactionType | null;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  other_user?: ConversationUser | null;
  settings?: ConversationSettings | null;
  messages: DirectMessage[];
  is_blocked: boolean;
}

export interface SendMessageRequest {
  conversation_id: string;
  content?: string | null;
  media?: MessageMedia[];
  gif?: GifSearchResult | null;
  reply_to_message_id?: string | null;
  client_message_id?: string | null;
}

export interface GifSearchResult {
  id: string;
  provider: "tenor";
  provider_id: string;
  title: string;
  url: string;
  preview_url: string;
  width?: number | null;
  height?: number | null;
}

export interface GifSearchResponse {
  results: GifSearchResult[];
  next?: string | null;
}

export type Conversation = ConversationSummary;
export type Message = DirectMessage;

const MESSAGE_MEDIA_BUCKET = "message-media";
const MESSAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_MESSAGE_MEDIA_BYTES = 8 * 1024 * 1024;
const MAX_MESSAGE_MEDIA_ITEMS = 4;

const toSafeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "message-media";

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value);

const normalizeLegacyConversation = (value: unknown): ConversationSummary | null => {
  const record = asRecord(value);
  if (!record?.id) return null;

  const lastMessage = asRecord(record.last_message);
  const otherUser = asRecord(record.other_user);
  const conversationId = asString(record.id);

  return {
    id: conversationId,
    participant_one_id: asString(record.participant_one_id),
    participant_two_id: asString(record.participant_two_id),
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
    other_user: otherUser
      ? {
          id: asString(otherUser.id),
          display_name:
            typeof otherUser.display_name === "string" ? otherUser.display_name : null,
          avatar_url: typeof otherUser.avatar_url === "string" ? otherUser.avatar_url : null,
        }
      : null,
    last_message: lastMessage
      ? {
          id: asString(lastMessage.id) || `${conversationId}-latest-message`,
          content: typeof lastMessage.content === "string" ? lastMessage.content : null,
          message_type: "text",
          created_at: asString(lastMessage.created_at),
          sender_id: asString(lastMessage.sender_id),
          deleted_at: null,
          media_count: 0,
        }
      : null,
    unread_count:
      typeof record.unread_count === "number"
        ? record.unread_count
        : Number(record.unread_count || 0),
    settings: null,
    is_blocked: false,
  };
};

const fetchConversationsLegacy = async (): Promise<ConversationSummary[]> => {
  const user = await getCurrentAuthUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_conversation_summaries", {
    p_user_id: user.id,
  });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  return rows
    .map(normalizeLegacyConversation)
    .filter((conversation): conversation is ConversationSummary => Boolean(conversation));
};

const getOtherParticipantId = (
  conversation: Pick<ConversationSummary, "participant_one_id" | "participant_two_id">,
  userId: string
) =>
  conversation.participant_one_id === userId
    ? conversation.participant_two_id
    : conversation.participant_two_id === userId
      ? conversation.participant_one_id
      : null;

const getOrCreateConversationLegacy = async (otherUserId: string): Promise<string | null> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");
  if (user.id === otherUserId) throw new Error("Cannot message yourself");

  const { data: existing, error: existingError } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(participant_one_id.eq.${user.id},participant_two_id.eq.${otherUserId}),and(participant_one_id.eq.${otherUserId},participant_two_id.eq.${user.id})`
    )
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return existing.id;

  const { data: newConversation, error } = await supabase
    .from("conversations")
    .insert({
      participant_one_id: user.id,
      participant_two_id: otherUserId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return newConversation.id;
};

const normalizeLegacyMessage = (value: Record<string, unknown>): DirectMessage => ({
  id: asString(value.id),
  conversation_id: asString(value.conversation_id),
  sender_id: asString(value.sender_id),
  content: typeof value.content === "string" ? value.content : null,
  message_type: "text",
  is_read: typeof value.is_read === "boolean" ? value.is_read : null,
  reply_to_message_id: null,
  client_message_id: null,
  edited_at: null,
  deleted_at: null,
  metadata: null,
  created_at: asString(value.created_at),
  updated_at: typeof value.updated_at === "string" ? value.updated_at : undefined,
  media: [],
  reactions: [],
  reaction_counts: {},
  current_user_reaction: null,
});

const fetchConversationDetailLegacy = async (
  conversationId: string
): Promise<ConversationDetail> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) throw conversationError;
  if (!conversation) throw new Error("Conversation not found");

  const otherUserId = getOtherParticipantId(conversation, user.id);
  if (!otherUserId) throw new Error("Not allowed");

  const [{ data: profile, error: profileError }, { data: messages, error: messagesError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id,display_name,avatar_url,show_online_status,last_seen_at,reader_status")
        .eq("id", otherUserId)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id,conversation_id,sender_id,content,is_read,created_at,updated_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true }),
    ]);

  if (profileError) throw profileError;
  if (messagesError) throw messagesError;

  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .eq("is_read", false);

  const normalizedMessages = (messages || []).map((message) =>
    normalizeLegacyMessage(message as Record<string, unknown>)
  );
  const latestMessage = normalizedMessages[normalizedMessages.length - 1] || null;
  const summary: ConversationSummary = {
    ...conversation,
    other_user: profile || null,
    last_message: latestMessage
      ? {
          id: latestMessage.id,
          content: latestMessage.content,
          message_type: latestMessage.message_type,
          created_at: latestMessage.created_at,
          sender_id: latestMessage.sender_id,
          deleted_at: null,
          media_count: 0,
        }
      : null,
    unread_count: 0,
    settings: null,
    is_blocked: false,
  };

  return {
    conversation: summary,
    other_user: profile || null,
    settings: null,
    messages: normalizedMessages,
    is_blocked: false,
  };
};

const sendTextMessageLegacy = async (
  conversationId: string,
  content: string
): Promise<DirectMessage> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: sanitizeInput(content),
    })
    .select("id,conversation_id,sender_id,content,is_read,created_at,updated_at")
    .single();

  if (error) throw error;
  return normalizeLegacyMessage(data as Record<string, unknown>);
};

export const fetchConversations = async (): Promise<ConversationSummary[]> => {
  return withContentSnapshot("conversations", "home", async () => {
    try {
      const response = await invokeFunction<{ conversations: ConversationSummary[] }>(
        "conversations-home"
      );
      return response.conversations || [];
    } catch (error) {
      console.warn("conversations-home unavailable; falling back to legacy conversation summaries", error);
      return fetchConversationsLegacy();
    }
  });
};

export const getOrCreateConversation = async (
  otherUserId: string
): Promise<string | null> => {
  try {
    const response = await invokeFunction<{ conversation_id: string }>(
      "get-or-create-conversation",
      { body: { other_user_id: otherUserId } }
    );
    return response.conversation_id;
  } catch (error) {
    console.warn(
      "get-or-create-conversation unavailable; falling back to legacy conversation creation",
      error
    );
    return getOrCreateConversationLegacy(otherUserId);
  }
};

export const fetchConversationDetail = async (
  conversationId: string
): Promise<ConversationDetail> => {
  try {
    return await invokeFunction<ConversationDetail>("conversation-detail", {
      body: { conversation_id: conversationId },
    });
  } catch (error) {
    console.warn("conversation-detail unavailable; falling back to legacy messages", error);
    return fetchConversationDetailLegacy(conversationId);
  }
};

export const fetchMessages = async (
  conversationId: string
): Promise<DirectMessage[]> => {
  const detail = await fetchConversationDetail(conversationId);
  return detail.messages || [];
};

export const uploadMessageMediaFiles = async (files: File[]): Promise<MessageMedia[]> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  if (files.length > MAX_MESSAGE_MEDIA_ITEMS) {
    throw new Error("Messages can include up to 4 media items");
  }

  const uploaded: MessageMedia[] = [];

  for (const [index, file] of files.entries()) {
    if (!MESSAGE_MEDIA_TYPES.has(file.type)) {
      throw new Error(`${file.name} is not a supported image or GIF`);
    }
    if (file.size > MAX_MESSAGE_MEDIA_BYTES) {
      throw new Error(`${file.name} must be 8 MB or smaller`);
    }

    const storagePath = `${user.id}/${crypto.randomUUID()}-${toSafeFileName(file.name)}`;
    const { error } = await supabase.storage
      .from(MESSAGE_MEDIA_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "31536000",
        upsert: false,
        contentType: file.type,
      });

    if (error) throw error;

    uploaded.push({
      media_source: "upload",
      media_type: file.type === "image/gif" ? "gif" : "image",
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      position: index,
    });
  }

  return uploaded;
};

export const sendMessage = async (
  conversationOrRequest: string | SendMessageRequest,
  content?: string
): Promise<DirectMessage> => {
  const payload: SendMessageRequest =
    typeof conversationOrRequest === "string"
      ? {
          conversation_id: conversationOrRequest,
          content: sanitizeInput(content || ""),
          client_message_id: crypto.randomUUID(),
        }
      : {
          ...conversationOrRequest,
          content: conversationOrRequest.content
            ? sanitizeInput(conversationOrRequest.content)
            : conversationOrRequest.content,
          client_message_id: conversationOrRequest.client_message_id || crypto.randomUUID(),
        };

  try {
    const response = await invokeFunction<{ message: DirectMessage }>("send-message", {
      body: payload,
    });
    return response.message;
  } catch (error) {
    const hasOnlyText =
      !payload.media?.length && !payload.gif && !payload.reply_to_message_id && payload.content;
    if (!hasOnlyText) throw error;

    console.warn("send-message unavailable; falling back to legacy text send", error);
    return sendTextMessageLegacy(payload.conversation_id, payload.content || "");
  }
};

export const markConversationRead = async (
  conversationId: string,
  lastReadMessageId?: string | null
): Promise<void> => {
  try {
    await invokeFunction("mark-conversation-read", {
      body: {
        conversation_id: conversationId,
        last_read_message_id: lastReadMessageId || null,
      },
    });
  } catch (error) {
    const user = await getCurrentAuthUser();
    if (!user) throw error;

    console.warn("mark-conversation-read unavailable; falling back to legacy read flag", error);
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .eq("is_read", false);
  }
};

export const toggleMessageReaction = async (
  messageId: string,
  reactionType: MessageReactionType
): Promise<{ reaction: MessageReactionType | null; message: DirectMessage }> => {
  return invokeFunction("toggle-message-reaction", {
    body: { message_id: messageId, reaction_type: reactionType },
  });
};

export const updateConversationSettings = async (
  conversationId: string,
  settings: Partial<Pick<ConversationSettings, "is_muted" | "is_pinned" | "is_archived">> & {
    hidden?: boolean;
  }
): Promise<ConversationSettings> => {
  const response = await invokeFunction<{ settings: ConversationSettings }>(
    "update-conversation-settings",
    {
      body: {
        conversation_id: conversationId,
        ...settings,
      },
    }
  );
  return response.settings;
};

export const deleteConversation = async (
  conversationId: string
): Promise<void> => {
  await updateConversationSettings(conversationId, { hidden: true });
};

export const deleteMessage = async (messageId: string): Promise<void> => {
  await invokeFunction("delete-message", {
    body: { message_id: messageId },
  });
};

export const searchMessageGifs = async (
  query: string,
  pos?: string | null
): Promise<GifSearchResponse> => {
  return invokeFunction<GifSearchResponse>("search-message-gifs", {
    body: { query, pos: pos || null, limit: 18 },
  });
};

export const createMessageRecord = async (
  data: Record<string, unknown>
): Promise<void> => {
  await sendMessage(data as unknown as SendMessageRequest);
};

export const subscribeToConversationChanges = (
  onChange: () => void
): (() => void) => {
  const handle = () => onChange();
  window.addEventListener("messages-changed", handle);
  window.addEventListener("focus", handle);
  return () => {
    window.removeEventListener("messages-changed", handle);
    window.removeEventListener("focus", handle);
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
        event: "*",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_reactions",
        filter: `conversation_id=eq.${conversationId}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "message_media",
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
