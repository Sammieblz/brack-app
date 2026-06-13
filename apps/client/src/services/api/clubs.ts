import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "./client";
import { getCurrentAuthUser } from "./auth";

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
  parent_id?: string;
  discussion_type?: "discussion" | "announcement";
  is_pinned?: boolean;
  media?: ClubMedia[];
}

const CLUB_MEDIA_BUCKET = "club-media";
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

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
