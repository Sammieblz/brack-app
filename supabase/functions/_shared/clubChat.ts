import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { createClubMediaSignedUrl } from "./clubs.ts";
import { sanitizeString } from "./messaging.ts";

export type ClubChatReactionType = "like" | "dislike" | "heart" | "laugh" | "wow" | "thanks";

export const CLUB_CHAT_REACTIONS = new Set<ClubChatReactionType>([
  "like",
  "dislike",
  "heart",
  "laugh",
  "wow",
  "thanks",
]);

export const CLUB_CHAT_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const MAX_CLUB_CHAT_MEDIA_BYTES = 10 * 1024 * 1024;
export const MAX_CLUB_CHAT_MEDIA_ITEMS = 4;

export const CLUB_CHAT_MESSAGE_SELECT =
  "id,club_id,user_id,content,message_type,reply_to_message_id,client_message_id,metadata,edited_at,deleted_at,created_at,updated_at";

export const requireClubMember = async (
  supabaseClient: SupabaseClient,
  clubId: string,
  userId: string,
) => {
  const { data, error } = await supabaseClient
    .from("book_club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { error: "Club membership required", status: 403 as const };
  return { role: String(data.role || "member") };
};

export const canModerateClub = async (
  supabaseClient: SupabaseClient,
  clubId: string,
  userId: string,
): Promise<boolean> => {
  const { data, error } = await supabaseClient
    .from("book_club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.role === "admin" || data?.role === "moderator";
};

export const getBlockedUserIdsForUser = async (
  supabaseClient: SupabaseClient,
  userId: string,
): Promise<Set<string>> => {
  const { data, error } = await supabaseClient
    .from("user_blocks")
    .select("blocker_id,blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of data || []) {
    ids.add(row.blocker_id === userId ? row.blocked_id : row.blocker_id);
  }
  return ids;
};

export const isClubPairBlocked = async (
  supabaseClient: SupabaseClient,
  userA: string,
  userB: string,
): Promise<boolean> => {
  const { data, error } = await supabaseClient
    .from("user_blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`,
    )
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
};

export const normalizeClubChatUploadedMedia = (
  userId: string,
  clubId: string,
  media: Array<Record<string, unknown>> | undefined,
) => {
  const items = Array.isArray(media) ? media : [];
  if (items.length > MAX_CLUB_CHAT_MEDIA_ITEMS) throw new Error("Messages can include up to 4 media items");

  return items.map((item, index) => {
    const storagePath = sanitizeString(item.storage_path, 700);
    const mimeType = sanitizeString(item.mime_type, 100);
    const sizeBytes = Number(item.size_bytes || 0);
    if (!storagePath || !storagePath.startsWith(`${userId}/`)) throw new Error("Media path is invalid");
    if (!CLUB_CHAT_IMAGE_MIME_TYPES.has(mimeType)) throw new Error("Unsupported media type");
    if (sizeBytes <= 0 || sizeBytes > MAX_CLUB_CHAT_MEDIA_BYTES) {
      throw new Error("Club chat media must be 10 MB or smaller");
    }
    return {
      club_id: clubId,
      user_id: userId,
      media_source: "upload",
      media_type: mimeType === "image/gif" ? "gif" : "image",
      bucket_id: "club-media",
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

export const normalizeClubChatTenorGif = (
  userId: string,
  clubId: string,
  gif: Record<string, unknown> | null | undefined,
) => {
  if (!gif) return null;
  const providerId = sanitizeString(gif.provider_id || gif.id, 120);
  const externalUrl = sanitizeString(gif.url || gif.external_url, 1000);
  const previewUrl = sanitizeString(gif.preview_url, 1000) || externalUrl;
  if (!providerId || !externalUrl) throw new Error("GIF selection is invalid");
  return {
    club_id: clubId,
    user_id: userId,
    media_source: "tenor",
    media_type: "gif",
    bucket_id: "club-media",
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
    metadata: { title: sanitizeString(gif.title, 200) },
  };
};

export const enrichClubChatMessages = async (
  supabaseClient: SupabaseClient,
  messages: Array<Record<string, unknown>>,
  currentUserId: string,
) => {
  if (messages.length === 0) return [];
  const messageIds = messages.map((message) => String(message.id));
  const userIds = Array.from(new Set(messages.map((message) => String(message.user_id))));
  const replyIds = Array.from(
    new Set(messages.map((message) => message.reply_to_message_id).filter(Boolean).map(String)),
  );

  const [mediaResult, reactionsResult, profilesResult, repliesResult] = await Promise.all([
    supabaseClient
      .from("club_chat_media")
      .select("*")
      .in("message_id", messageIds)
      .order("position", { ascending: true }),
    supabaseClient.from("club_chat_reactions").select("*").in("message_id", messageIds),
    supabaseClient.from("profiles").select("id,display_name,avatar_url").in("id", userIds),
    replyIds.length
      ? supabaseClient.from("club_chat_messages").select(CLUB_CHAT_MESSAGE_SELECT).in("id", replyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (mediaResult.error) throw mediaResult.error;
  if (reactionsResult.error) throw reactionsResult.error;
  if (profilesResult.error) throw profilesResult.error;
  if (repliesResult.error) throw repliesResult.error;

  const profiles = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const replies = new Map((repliesResult.data || []).map((reply) => [reply.id, reply]));

  const mediaByMessage = new Map<string, Array<Record<string, unknown>>>();
  for (const item of mediaResult.data || []) {
    const signedUrl =
      item.media_source === "upload"
        ? await createClubMediaSignedUrl(supabaseClient, item.storage_path)
        : item.external_url;
    const previewUrl =
      item.media_source === "upload" ? signedUrl : item.preview_url || item.external_url;
    const group = mediaByMessage.get(item.message_id) || [];
    group.push({ ...item, signed_url: signedUrl, preview_url: previewUrl });
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
    const reply = message.reply_to_message_id ? replies.get(String(message.reply_to_message_id)) : null;
    return {
      ...message,
      user: profiles.get(String(message.user_id)) || null,
      media: message.deleted_at ? [] : mediaByMessage.get(String(message.id)) || [],
      reactions,
      reaction_counts: reactionCounts,
      current_user_reaction:
        reactions.find((reaction) => reaction.user_id === currentUserId)?.reaction_type || null,
      reply_to_message: reply
        ? {
            id: reply.id,
            user_id: reply.user_id,
            content: reply.deleted_at ? null : reply.content,
            message_type: reply.message_type,
            deleted_at: reply.deleted_at,
            user: profiles.get(String(reply.user_id)) || null,
          }
        : null,
    };
  });
};

export const extractMentionIds = async (
  supabaseClient: SupabaseClient,
  clubId: string,
  userId: string,
  mentionIds: unknown,
): Promise<string[]> => {
  if (!Array.isArray(mentionIds)) return [];
  const unique = Array.from(
    new Set(mentionIds.filter((id): id is string => typeof id === "string" && id !== userId)),
  ).slice(0, 20);
  if (unique.length === 0) return [];
  const { data, error } = await supabaseClient
    .from("book_club_members")
    .select("user_id")
    .eq("club_id", clubId)
    .in("user_id", unique);
  if (error) throw error;
  return (data || []).map((row) => row.user_id);
};
