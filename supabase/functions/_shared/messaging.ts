import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

export type MessageReactionType = "like" | "dislike" | "heart" | "laugh" | "wow" | "thanks";

export const MESSAGE_REACTIONS = new Set<MessageReactionType>([
  "like",
  "dislike",
  "heart",
  "laugh",
  "wow",
  "thanks",
]);

export const MESSAGE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const MAX_MESSAGE_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_MESSAGE_MEDIA_ITEMS = 4;

export const sanitizeString = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

export const asNullableUuid = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const assertOwnedStoragePath = (userId: string, path: string): void => {
  if (!path.startsWith(`${userId}/`)) {
    throw new Error("Media path is not owned by the authenticated user");
  }
};

export const getConversation = async (
  supabaseClient: SupabaseClient,
  conversationId: string
) => {
  const { data, error } = await supabaseClient
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  return data as Record<string, unknown> | null;
};

export const otherParticipantId = (
  conversation: Record<string, unknown>,
  userId: string
): string | null => {
  const one = String(conversation.participant_one_id || "");
  const two = String(conversation.participant_two_id || "");
  if (one === userId) return two;
  if (two === userId) return one;
  return null;
};

export const requireConversationAccess = async (
  supabaseClient: SupabaseClient,
  conversationId: string,
  userId: string
) => {
  const conversation = await getConversation(supabaseClient, conversationId);
  if (!conversation) {
    return { error: "Conversation not found", status: 404 as const };
  }

  const otherUserId = otherParticipantId(conversation, userId);
  if (!otherUserId) {
    return { error: "Not allowed", status: 403 as const };
  }

  return { conversation, otherUserId };
};

export const isPairBlocked = async (
  supabaseClient: SupabaseClient,
  userA: string,
  userB: string
): Promise<boolean> => {
  const { data, error } = await supabaseClient
    .from("user_blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`
    )
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
};

const signUploadedMedia = async (
  supabaseClient: SupabaseClient,
  storagePath: string | null,
  canSign: boolean
): Promise<string | null> => {
  if (!storagePath || !canSign) return null;
  const { data, error } = await supabaseClient.storage
    .from("message-media")
    .createSignedUrl(storagePath, 3600);
  if (error) {
    console.error("Failed to sign message media", error);
    return null;
  }
  return data?.signedUrl ?? null;
};

export const enrichMessages = async (
  supabaseClient: SupabaseClient,
  messages: Array<Record<string, unknown>>,
  currentUserId: string,
  canShowMedia: boolean
) => {
  if (messages.length === 0) return [];

  const messageIds = messages.map((message) => String(message.id));

  const [mediaResult, reactionsResult] = await Promise.all([
    supabaseClient
      .from("message_media")
      .select("*")
      .in("message_id", messageIds)
      .order("position", { ascending: true }),
    supabaseClient
      .from("message_reactions")
      .select("*")
      .in("message_id", messageIds),
  ]);

  if (mediaResult.error) throw mediaResult.error;
  if (reactionsResult.error) throw reactionsResult.error;

  const mediaByMessage = new Map<string, Array<Record<string, unknown>>>();
  for (const item of mediaResult.data || []) {
    const signedUrl =
      item.media_source === "upload"
        ? await signUploadedMedia(supabaseClient, item.storage_path, canShowMedia)
        : canShowMedia
          ? item.external_url
          : null;
    const previewUrl =
      item.media_source === "upload"
        ? signedUrl
        : canShowMedia
          ? item.preview_url || item.external_url
          : null;

    const normalized = {
      ...item,
      signed_url: signedUrl,
      preview_url: previewUrl,
    };
    const group = mediaByMessage.get(item.message_id) || [];
    group.push(normalized);
    mediaByMessage.set(item.message_id, group);
  }

  const reactionsByMessage = new Map<string, Array<Record<string, unknown>>>();
  for (const reaction of reactionsResult.data || []) {
    const group = reactionsByMessage.get(reaction.message_id) || [];
    group.push(reaction);
    reactionsByMessage.set(reaction.message_id, group);
  }

  return messages.map((message) => {
    const reactions = reactionsByMessage.get(String(message.id)) || [];
    const reactionCounts = reactions.reduce<Record<string, number>>((acc, reaction) => {
      const type = String(reaction.reaction_type || "");
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    const currentUserReaction =
      reactions.find((reaction) => reaction.user_id === currentUserId)?.reaction_type || null;

    return {
      ...message,
      media: message.deleted_at ? [] : mediaByMessage.get(String(message.id)) || [],
      reactions,
      reaction_counts: reactionCounts,
      current_user_reaction: currentUserReaction,
    };
  });
};

export const normalizeUploadedMedia = (
  userId: string,
  conversationId: string,
  media: Array<Record<string, unknown>> | undefined
) => {
  const items = Array.isArray(media) ? media : [];
  if (items.length > MAX_MESSAGE_MEDIA_ITEMS) {
    throw new Error("Messages can include up to 4 media items");
  }

  return items.map((item, index) => {
    const storagePath = sanitizeString(item.storage_path, 500);
    const mimeType = sanitizeString(item.mime_type, 100);
    const sizeBytes = Number(item.size_bytes || 0);

    if (!storagePath) throw new Error("Media path is required");
    assertOwnedStoragePath(userId, storagePath);
    if (!MESSAGE_IMAGE_MIME_TYPES.has(mimeType)) throw new Error("Unsupported media type");
    if (sizeBytes <= 0 || sizeBytes > MAX_MESSAGE_MEDIA_BYTES) {
      throw new Error("Message media must be 8 MB or smaller");
    }

    return {
      conversation_id: conversationId,
      user_id: userId,
      media_source: "upload",
      media_type: mimeType === "image/gif" ? "gif" : "image",
      bucket_id: "message-media",
      storage_path: storagePath,
      external_url: null,
      preview_url: null,
      provider: null,
      provider_id: null,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      width: item.width == null ? null : Number(item.width),
      height: item.height == null ? null : Number(item.height),
      position: index,
      metadata: {},
    };
  });
};

export const normalizeTenorGif = (
  _userId: string,
  conversationId: string,
  gif: Record<string, unknown> | null | undefined
) => {
  if (!gif) return null;

  const providerId = sanitizeString(gif.provider_id || gif.id, 120);
  const externalUrl = sanitizeString(gif.url || gif.external_url, 1000);
  const previewUrl = sanitizeString(gif.preview_url, 1000) || externalUrl;

  if (!providerId || !externalUrl) {
    throw new Error("GIF selection is invalid");
  }

  return {
    conversation_id: conversationId,
    user_id: userId,
    media_source: "tenor",
    media_type: "gif",
    bucket_id: "message-media",
    storage_path: null,
    external_url: externalUrl,
    preview_url: previewUrl,
    provider: "tenor",
    provider_id: providerId,
    mime_type: "image/gif",
    size_bytes: null,
    width: gif.width == null ? null : Number(gif.width),
    height: gif.height == null ? null : Number(gif.height),
    position: 0,
    metadata: {
      title: sanitizeString(gif.title, 200),
    },
  };
};
