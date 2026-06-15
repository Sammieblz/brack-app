import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "./client";
import { getCurrentAuthUser } from "./auth";
import type { RichTextDocument, RichTextFormat } from "@/types/richText";

export type ClubMemberRole = "admin" | "moderator" | "member";
export type ClubJoinStatus = "none" | "member" | "requested" | "invited";
export type ClubSectionKey =
  | "myClubs"
  | "suggested"
  | "nearby"
  | "popular"
  | "newest"
  | "invites"
  | "pendingRequests"
  | "searchResults";

export interface ClubBookPreview {
  id: string;
  title: string;
  author?: string | null;
  cover_url?: string | null;
  pages?: number | null;
  genre?: string | null;
  status?: string | null;
  current_page?: number | null;
}

export interface ClubPreview {
  id: string;
  name: string;
  description?: string | null;
  created_by: string;
  current_book_id?: string | null;
  cover_image_url?: string | null;
  banner_image_path?: string | null;
  avatar_image_path?: string | null;
  banner_image_url?: string | null;
  avatar_image_url?: string | null;
  is_private: boolean;
  preview_only?: boolean;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  genres: string[];
  tags: string[];
  member_limit?: number | null;
  member_count: number;
  discussion_count: number;
  announcement_count: number;
  last_activity_at?: string | null;
  created_at: string;
  updated_at: string;
  user_role?: ClubMemberRole | null;
  join_status?: ClubJoinStatus;
  request_id?: string | null;
  invite_id?: string | null;
  distance_km?: number | null;
  shared_member_count?: number;
  recommendation_score?: number;
  recommendation_reason?: string | null;
  current_book?: ClubBookPreview | null;
}

export type ClubMediaType = "image" | "video";
export type ClubChatMessageType = "text" | "media" | "gif";
export type ClubChatMediaSource = "upload" | "tenor";
export type ClubChatMediaType = "image" | "gif";
export type ClubChatReactionType = "like" | "dislike" | "heart" | "laugh" | "wow" | "thanks";

export interface ClubMedia {
  storage_path: string;
  signed_url?: string | null;
  thumbnail_path?: string | null;
  thumbnail_url?: string | null;
  media_type: ClubMediaType;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
  position?: number;
  alt_text?: string | null;
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

export interface ClubChatUser {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
}

export interface ClubChatMedia {
  id?: string;
  message_id?: string;
  club_id?: string;
  user_id?: string;
  media_source: ClubChatMediaSource;
  media_type: ClubChatMediaType;
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

export interface ClubChatReaction {
  id: string;
  message_id: string;
  club_id: string;
  user_id: string;
  reaction_type: ClubChatReactionType;
  created_at: string;
  updated_at?: string;
}

export interface ClubChatTypingUser {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  isTyping: boolean;
  timestamp: number;
}

export interface ClubChatTypingSubscription {
  setTyping: (isTyping: boolean) => Promise<void>;
  cleanup: () => void;
}

export interface ClubChatMessage {
  id: string;
  club_id: string;
  user_id: string;
  content: string | null;
  message_type: ClubChatMessageType;
  reply_to_message_id?: string | null;
  client_message_id?: string | null;
  metadata?: Record<string, unknown> | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at?: string;
  user?: ClubChatUser | null;
  media?: ClubChatMedia[];
  reactions?: ClubChatReaction[];
  reaction_counts?: Partial<Record<ClubChatReactionType, number>>;
  current_user_reaction?: ClubChatReactionType | null;
  reply_to_message?: {
    id: string;
    user_id: string;
    content: string | null;
    message_type: ClubChatMessageType;
    deleted_at?: string | null;
    user?: ClubChatUser | null;
  } | null;
}

export interface ClubChatSettings {
  club_id: string;
  user_id: string;
  is_muted: boolean;
  last_opened_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClubChatHistoryResponse {
  messages: ClubChatMessage[];
  next_cursor?: string | null;
  has_more: boolean;
  settings?: ClubChatSettings | null;
}

export interface SendClubChatMessageRequest {
  club_id: string;
  content?: string | null;
  media?: ClubChatMedia[];
  gif?: GifSearchResult | null;
  reply_to_message_id?: string | null;
  mention_ids?: string[];
  client_message_id?: string | null;
}

export type BookClub = ClubPreview;

export interface ClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubMemberRole;
  joined_at: string;
  user?: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
    reader_status?: string | null;
    last_seen_at?: string | null;
    show_online_status?: boolean | null;
  } | null;
}

export interface ClubDiscussion {
  id: string;
  club_id: string;
  user_id: string;
  title?: string | null;
  content: string;
  content_format?: RichTextFormat | null;
  content_json?: RichTextDocument | null;
  content_html?: string | null;
  parent_id?: string | null;
  discussion_type?: "discussion" | "announcement";
  is_pinned?: boolean;
  reply_count?: number;
  media?: ClubMedia[];
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
  } | null;
  replies?: ClubDiscussion[];
}

export interface ClubJoinRequest {
  id: string;
  club_id: string;
  user_id: string;
  message?: string | null;
  status: "pending" | "approved" | "declined" | "cancelled";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  user?: ClubMember["user"];
}

export interface ClubInvite {
  id: string;
  club_id: string;
  invited_user_id: string;
  invited_by: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  message?: string | null;
  expires_at?: string | null;
  responded_at?: string | null;
  created_at: string;
  updated_at: string;
  invited_user?: ClubMember["user"];
  invited_by_user?: ClubMember["user"];
}

export interface ClubsHomeResponse {
  myClubs: ClubPreview[];
  suggested: ClubPreview[];
  nearby: ClubPreview[];
  popular: ClubPreview[];
  newest: ClubPreview[];
  invites: ClubPreview[];
  pendingRequests: ClubPreview[];
  searchResults: ClubPreview[];
  summary: {
    my_clubs: number;
    suggested: number;
    nearby: number;
    invites: number;
    pending_requests: number;
  };
}

export interface ClubDetailResponse {
  club: ClubPreview;
  user_role?: ClubMemberRole | null;
  members: ClubMember[];
  discussions: ClubDiscussion[];
  announcements: ClubDiscussion[];
  admin?: {
    pending_requests: ClubJoinRequest[];
    pending_invites: ClubInvite[];
  } | null;
}

export interface CreateBookClubRequest {
  name: string;
  description?: string;
  is_private?: boolean;
  cover_image_url?: string;
  banner_image_path?: string;
  avatar_image_path?: string;
  current_book_id?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  genres?: string[];
  tags?: string[];
  member_limit?: number | null;
}

export interface CreateClubDiscussionRequest {
  title?: string;
  content: string;
  content_format?: RichTextFormat;
  content_json?: RichTextDocument | null;
  content_html?: string | null;
  parent_id?: string;
  discussion_type?: "discussion" | "announcement";
  is_pinned?: boolean;
  media?: ClubMedia[];
}

const CLUB_MEDIA_BUCKET = "club-media";
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const CLUB_CHAT_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const MAX_CHAT_MEDIA_BYTES = 10 * 1024 * 1024;

const toSafeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "media";

export const uploadClubImageFile = async (
  file: File,
  purpose: "banner" | "avatar",
  clubId?: string
): Promise<string> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");
  if (!IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error("Club images must be JPEG, PNG, WebP, or GIF");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Club images must be 10 MB or smaller");
  }

  const storagePath = `${user.id}/clubs/${clubId || "new"}/${purpose}-${crypto.randomUUID()}-${toSafeFileName(file.name)}`;
  const { error } = await supabase.storage
    .from(CLUB_MEDIA_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type,
    });
  if (error) throw error;
  return storagePath;
};

export const uploadClubDiscussionMediaFiles = async (
  files: File[],
  clubId: string
): Promise<ClubMedia[]> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const imageCount = files.filter((file) => IMAGE_MIME_TYPES.has(file.type)).length;
  const videoCount = files.filter((file) => VIDEO_MIME_TYPES.has(file.type)).length;
  if (imageCount > 4) throw new Error("Club posts can include up to 4 images");
  if (videoCount > 1) throw new Error("Club posts can include up to 1 video");
  if (imageCount > 0 && videoCount > 0) {
    throw new Error("Use either images or one video per club post");
  }

  const uploaded: ClubMedia[] = [];
  for (const [index, file] of files.entries()) {
    const isImage = IMAGE_MIME_TYPES.has(file.type);
    const isVideo = VIDEO_MIME_TYPES.has(file.type);
    if (!isImage && !isVideo) throw new Error(`${file.name} is not a supported media type`);
    if (isImage && file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} must be 10 MB or smaller`);
    if (isVideo && file.size > MAX_VIDEO_BYTES) throw new Error(`${file.name} must be 60 MB or smaller`);

    const storagePath = `${user.id}/clubs/${clubId}/discussions/${crypto.randomUUID()}-${toSafeFileName(file.name)}`;
    const { error } = await supabase.storage
      .from(CLUB_MEDIA_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "31536000",
        upsert: false,
        contentType: file.type,
      });
    if (error) throw error;

    uploaded.push({
      storage_path: storagePath,
      media_type: isVideo ? "video" : "image",
      mime_type: file.type,
      size_bytes: file.size,
      position: index,
    });
  }

  return uploaded;
};

export const uploadClubChatMediaFiles = async (
  files: File[],
  clubId: string
): Promise<ClubChatMedia[]> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");
  if (files.length > 4) throw new Error("Club chat messages can include up to 4 media items");

  const uploaded: ClubChatMedia[] = [];
  for (const [index, file] of files.entries()) {
    if (!CLUB_CHAT_MEDIA_TYPES.has(file.type)) {
      throw new Error(`${file.name} is not a supported image or GIF`);
    }
    if (file.size > MAX_CHAT_MEDIA_BYTES) {
      throw new Error(`${file.name} must be 10 MB or smaller`);
    }

    const storagePath = `${user.id}/clubs/${clubId}/chat/${crypto.randomUUID()}-${toSafeFileName(file.name)}`;
    const { error } = await supabase.storage
      .from(CLUB_MEDIA_BUCKET)
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

const uniqueById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export const getClubsHome = async (filters: {
  searchQuery?: string;
  limit?: number;
  maxDistance?: number;
} = {}): Promise<ClubsHomeResponse> => {
  return invokeFunction<ClubsHomeResponse>("clubs-home", {
    body: filters,
  });
};

export const getClubDetail = async (clubId: string): Promise<ClubDetailResponse> => {
  return invokeFunction<ClubDetailResponse>("club-detail", {
    body: { clubId },
  });
};

export const createBookClub = async (
  clubData: CreateBookClubRequest
): Promise<BookClub> => {
  const response = await invokeFunction<{ club: BookClub }>("create-club", {
    body: clubData,
  });
  return response.club;
};

export const joinBookClub = async (clubId: string): Promise<void> => {
  await invokeFunction<{ ok: boolean }>("join-club", {
    body: { clubId },
  });
};

export const leaveBookClub = async (clubId: string): Promise<void> => {
  await invokeFunction<{ ok: boolean }>("leave-club", {
    body: { clubId },
  });
};

export const requestJoinClub = async (
  clubId: string,
  message?: string
): Promise<ClubJoinRequest | null> => {
  const response = await invokeFunction<{ request?: ClubJoinRequest }>("request-club-join", {
    body: { clubId, message },
  });
  return response.request ?? null;
};

export const reviewJoinRequest = async (
  requestId: string,
  decision: "approve" | "decline"
): Promise<void> => {
  await invokeFunction<{ ok: boolean }>("review-club-join-request", {
    body: { requestId, decision },
  });
};

export const inviteClubMember = async (
  clubId: string,
  invitedUserId: string,
  message?: string
): Promise<ClubInvite | null> => {
  const response = await invokeFunction<{ invite?: ClubInvite }>("invite-club-member", {
    body: { clubId, invitedUserId, message },
  });
  return response.invite ?? null;
};

export const respondClubInvite = async (
  inviteId: string,
  decision: "accept" | "decline"
): Promise<void> => {
  await invokeFunction<{ ok: boolean }>("respond-club-invite", {
    body: { inviteId, decision },
  });
};

export const createClubDiscussion = async (
  clubId: string,
  data: CreateClubDiscussionRequest
): Promise<ClubDiscussion> => {
  const response = await invokeFunction<{ discussion: ClubDiscussion }>("create-club-discussion", {
    body: {
      clubId,
      title: data.title,
      content: data.content,
      content_format: data.content_format,
      content_json: data.content_json,
      content_html: data.content_html,
      rich_text: {
        content_format: data.content_format,
        content_json: data.content_json,
        content_html: data.content_html,
      },
      parentId: data.parent_id,
      discussionType: data.discussion_type,
      isPinned: data.is_pinned,
      media: data.media || [],
    },
  });
  return response.discussion;
};

export const updateClubMedia = async (
  clubId: string,
  updates: {
    banner_image_path?: string | null;
    avatar_image_path?: string | null;
  }
): Promise<BookClub> => {
  const response = await invokeFunction<{ club: BookClub }>("update-club-media", {
    body: { clubId, ...updates },
  });
  return response.club;
};

export const moderateClubDiscussion = async (
  discussionId: string,
  action: "delete" | "restore" | "pin" | "unpin"
): Promise<ClubDiscussion> => {
  const response = await invokeFunction<{ discussion: ClubDiscussion }>("moderate-club-discussion", {
    body: { discussionId, action },
  });
  return response.discussion;
};

export const getClubChatHistory = async (
  clubId: string,
  cursor?: string | null,
  limit = 40
): Promise<ClubChatHistoryResponse> => {
  return invokeFunction<ClubChatHistoryResponse>("club-chat-history", {
    body: { club_id: clubId, cursor: cursor || null, limit },
  });
};

export const sendClubChatMessage = async (
  request: SendClubChatMessageRequest
): Promise<ClubChatMessage> => {
  const response = await invokeFunction<{ message: ClubChatMessage }>("send-club-chat-message", {
    body: {
      ...request,
      content: request.content || null,
      client_message_id: request.client_message_id || crypto.randomUUID(),
    },
  });
  return response.message;
};

export const toggleClubChatReaction = async (
  messageId: string,
  reactionType: ClubChatReactionType
): Promise<{ reaction: ClubChatReactionType | null; message: ClubChatMessage }> => {
  return invokeFunction("toggle-club-chat-reaction", {
    body: { message_id: messageId, reaction_type: reactionType },
  });
};

export const markClubChatRead = async (
  clubId: string,
  lastReadMessageId?: string | null
): Promise<void> => {
  await invokeFunction("mark-club-chat-read", {
    body: { club_id: clubId, last_read_message_id: lastReadMessageId || null },
  });
};

export const deleteClubChatMessage = async (messageId: string): Promise<ClubChatMessage> => {
  const response = await invokeFunction<{ message: ClubChatMessage }>("delete-club-chat-message", {
    body: { message_id: messageId },
  });
  return response.message;
};

export const updateClubChatSettings = async (
  clubId: string,
  settings: Partial<Pick<ClubChatSettings, "is_muted">>
): Promise<ClubChatSettings> => {
  const response = await invokeFunction<{ settings: ClubChatSettings }>(
    "update-club-chat-settings",
    { body: { club_id: clubId, ...settings } }
  );
  return response.settings;
};

export const searchGifs = async (
  query: string,
  pos?: string | null
): Promise<GifSearchResponse> => {
  return invokeFunction<GifSearchResponse>("search-gifs", {
    body: { query, pos: pos || null, limit: 18 },
  });
};

export const subscribeToClubChatTypingIndicator = (
  clubId: string,
  currentUser: { id: string; name: string; avatarUrl?: string | null },
  onTypingUsersChange: (users: ClubChatTypingUser[]) => void
): ClubChatTypingSubscription => {
  const channel = supabase.channel(`club-chat-typing:${clubId}`, {
    config: {
      presence: {
        key: currentUser.id,
      },
    },
  });

  channel
    .on("presence", { event: "sync" }, () => {
      const now = Date.now();
      const state = channel.presenceState<ClubChatTypingUser>();
      const usersById = new Map<string, ClubChatTypingUser>();

      Object.values(state)
        .flat()
        .filter((user) => user.userId !== currentUser.id)
        .filter((user) => user.isTyping && now - user.timestamp < 6000)
        .forEach((user) => usersById.set(user.userId, user));

      onTypingUsersChange(Array.from(usersById.values()));
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId: currentUser.id,
          name: currentUser.name,
          avatarUrl: currentUser.avatarUrl || null,
          isTyping: false,
          timestamp: Date.now(),
        });
      }
    });

  return {
    setTyping: async (isTyping: boolean) => {
      await channel.track({
        userId: currentUser.id,
        name: currentUser.name,
        avatarUrl: currentUser.avatarUrl || null,
        isTyping,
        timestamp: Date.now(),
      });
    },
    cleanup: () => {
      supabase.removeChannel(channel);
    },
  };
};

export const manageClubMember = async (
  clubId: string,
  targetUserId: string,
  action: "remove" | "set_role",
  role?: ClubMemberRole
): Promise<void> => {
  await invokeFunction<{ ok: boolean }>("manage-club-member", {
    body: { clubId, targetUserId, action, role },
  });
};

export const fetchBookClubs = async (): Promise<BookClub[]> => {
  const home = await getClubsHome();
  return uniqueById([
    ...home.myClubs,
    ...home.suggested,
    ...home.nearby,
    ...home.popular,
    ...home.newest,
    ...home.invites,
    ...home.pendingRequests,
  ]);
};

export const fetchBookClubDetails = async (
  clubId: string
): Promise<BookClub | null> => {
  const detail = await getClubDetail(clubId);
  return detail.club;
};

export const fetchBookClubMembers = async (
  clubId: string
): Promise<ClubMember[]> => {
  const detail = await getClubDetail(clubId);
  return detail.members;
};

export const fetchClubDiscussions = async (
  clubId: string
): Promise<ClubDiscussion[]> => {
  const detail = await getClubDetail(clubId);
  return detail.discussions;
};

export const deleteClubDiscussion = async (
  discussionId: string
): Promise<void> => {
  await moderateClubDiscussion(discussionId, "delete");
};

export const updateBookClub = async (
  clubId: string,
  updates: Partial<BookClub>
): Promise<void> => {
  const { error } = await supabase
    .from("book_clubs")
    .update(updates)
    .eq("id", clubId);

  if (error) throw error;
};

export const deleteBookClub = async (clubId: string): Promise<void> => {
  const { error } = await supabase.from("book_clubs").delete().eq("id", clubId);
  if (error) throw error;
};

export const subscribeToClubDiscussions = (
  _clubId: string,
  _onChange: () => void
): (() => void) => {
  return () => undefined;
};

export const subscribeToClubChat = (
  clubId: string,
  onChange: () => void
): (() => void) => {
  const channel = supabase
    .channel(`club-chat-${clubId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "club_chat_messages",
        filter: `club_id=eq.${clubId}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "club_chat_reactions",
        filter: `club_id=eq.${clubId}`,
      },
      onChange
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "club_chat_media",
        filter: `club_id=eq.${clubId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
