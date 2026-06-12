import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { getBlockedUserIds, getFollowingIds, sanitizeString } from "./social.ts";

export type ClubRole = "admin" | "moderator" | "member";
export type ClubJoinStatus = "none" | "member" | "requested" | "invited";
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

const CLUB_MEDIA_BUCKET = "club-media";
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

export interface ClubRow {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  current_book_id: string | null;
  cover_image_url: string | null;
  banner_image_path: string | null;
  avatar_image_path: string | null;
  is_private: boolean | null;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  genres: string[] | null;
  tags: string[] | null;
  member_limit: number | null;
  last_activity_at: string | null;
  member_count: number | null;
  discussion_count: number | null;
  announcement_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface ViewerContext {
  userId: string;
  blockedIds: Set<string>;
  followingIds: Set<string>;
  userGenres: Set<string>;
  latitude: number | null;
  longitude: number | null;
  showLocation: boolean;
}

export const ACTIVE_CLUB_SELECT =
  "id,name,description,created_by,current_book_id,cover_image_url,banner_image_path,avatar_image_path,is_private,city,country,latitude,longitude,genres,tags,member_limit,last_activity_at,member_count,discussion_count,announcement_count,created_at,updated_at";

export const MEMBER_SELECT =
  "id,club_id,user_id,role,joined_at";

export const DISCUSSION_SELECT =
  "id,club_id,user_id,title,content,parent_id,discussion_type,is_pinned,reply_count,media,deleted_at,created_at,updated_at";

export const sanitizeClubMediaPath = (value: unknown, userId: string): string | null => {
  const path = sanitizeString(value, 700);
  if (!path) return null;
  if (!path.startsWith(`${userId}/`)) {
    throw new Error("Media must be uploaded by the current user");
  }
  if (path.includes("..") || path.startsWith("/") || path.includes("//")) {
    throw new Error("Invalid media path");
  }
  return path;
};

export const normalizeClubMediaItems = (
  value: unknown,
  userId: string,
): ClubMedia[] => {
  if (!Array.isArray(value)) return [];

  const normalized: ClubMedia[] = [];
  let imageCount = 0;
  let videoCount = 0;

  for (const [index, raw] of value.entries()) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const storagePath = sanitizeClubMediaPath(record.storage_path, userId);
    if (!storagePath) continue;

    const mimeType = sanitizeString(record.mime_type, 120);
    const mediaType: ClubMediaType = record.media_type === "video" ? "video" : "image";
    const sizeBytes = Number(record.size_bytes);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      throw new Error("Media size is required");
    }

    if (mediaType === "image") {
      imageCount += 1;
      if (!IMAGE_MIME_TYPES.has(mimeType)) throw new Error("Unsupported image type");
      if (sizeBytes > MAX_IMAGE_BYTES) throw new Error("Images must be 10 MB or smaller");
    } else {
      videoCount += 1;
      if (!VIDEO_MIME_TYPES.has(mimeType)) throw new Error("Unsupported video type");
      if (sizeBytes > MAX_VIDEO_BYTES) throw new Error("Videos must be 60 MB or smaller");
    }

    if (imageCount > 4) throw new Error("Club posts can include up to 4 images");
    if (videoCount > 1) throw new Error("Club posts can include up to 1 video");
    if (imageCount > 0 && videoCount > 0) {
      throw new Error("Use either images or one video per club post");
    }

    const thumbnailPath = sanitizeClubMediaPath(record.thumbnail_path, userId);
    normalized.push({
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      media_type: mediaType,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      width: Number.isFinite(Number(record.width)) ? Number(record.width) : null,
      height: Number.isFinite(Number(record.height)) ? Number(record.height) : null,
      duration_ms: Number.isFinite(Number(record.duration_ms)) ? Number(record.duration_ms) : null,
      position: Number.isFinite(Number(record.position)) ? Number(record.position) : index,
      alt_text: sanitizeString(record.alt_text, 180) || null,
    });
  }

  return normalized.sort((a, b) => (a.position || 0) - (b.position || 0));
};

export const createClubMediaSignedUrl = async (
  supabaseClient: SupabaseClient,
  path?: string | null,
  expiresIn = 3600,
): Promise<string | null> => {
  if (!path) return null;
  const { data, error } = await supabaseClient.storage
    .from(CLUB_MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) {
    console.warn("Failed to sign club media", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
};

export const getClubImageUrls = async (
  supabaseClient: SupabaseClient,
  club: Pick<ClubRow, "banner_image_path" | "avatar_image_path">,
) => {
  const [bannerImageUrl, avatarImageUrl] = await Promise.all([
    createClubMediaSignedUrl(supabaseClient, club.banner_image_path),
    createClubMediaSignedUrl(supabaseClient, club.avatar_image_path),
  ]);
  return { bannerImageUrl, avatarImageUrl };
};

export const signClubMediaItems = async (
  supabaseClient: SupabaseClient,
  media: unknown,
): Promise<ClubMedia[]> => {
  if (!Array.isArray(media)) return [];
  return Promise.all(
    media.map(async (item, index) => {
      const record = item as ClubMedia;
      const [signedUrl, thumbnailUrl] = await Promise.all([
        createClubMediaSignedUrl(supabaseClient, record.storage_path),
        createClubMediaSignedUrl(supabaseClient, record.thumbnail_path),
      ]);
      return {
        ...record,
        position: Number.isFinite(Number(record.position)) ? Number(record.position) : index,
        signed_url: signedUrl,
        thumbnail_url: thumbnailUrl,
      };
    }),
  );
};

export const sanitizeTextArray = (value: unknown, maxItems = 8, maxLength = 48): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of value) {
    const item = sanitizeString(raw, maxLength);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length >= maxItems) break;
  }
  return items;
};

export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const getViewerContext = async (
  supabaseClient: SupabaseClient,
  userId: string,
): Promise<ViewerContext> => {
  const [blockedIds, followingIds, profileResult, habitsResult, booksResult] = await Promise.all([
    getBlockedUserIds(supabaseClient, userId),
    getFollowingIds(supabaseClient, userId),
    supabaseClient
      .from("profiles")
      .select("latitude, longitude, show_location")
      .eq("id", userId)
      .maybeSingle(),
    supabaseClient
      .from("reading_habits")
      .select("genres")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseClient
      .from("books")
      .select("genre")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("genre", "is", null)
      .limit(80),
  ]);

  for (const result of [profileResult, habitsResult, booksResult]) {
    if (result.error) throw result.error;
  }

  const userGenres = new Set<string>();
  if (Array.isArray(habitsResult.data?.genres)) {
    for (const genre of habitsResult.data.genres) userGenres.add(String(genre));
  }
  for (const book of booksResult.data || []) {
    if (book.genre) userGenres.add(String(book.genre));
  }

  const showLocation = profileResult.data?.show_location !== false;
  return {
    userId,
    blockedIds,
    followingIds,
    userGenres,
    latitude: showLocation ? profileResult.data?.latitude ?? null : null,
    longitude: showLocation ? profileResult.data?.longitude ?? null : null,
    showLocation,
  };
};

export const getClubRoles = async (
  supabaseClient: SupabaseClient,
  userId: string,
  clubIds: string[],
): Promise<Map<string, ClubRole>> => {
  if (clubIds.length === 0) return new Map();
  const { data, error } = await supabaseClient
    .from("book_club_members")
    .select("club_id, role")
    .eq("user_id", userId)
    .in("club_id", clubIds);
  if (error) throw error;
  return new Map((data || []).map((row) => [row.club_id as string, row.role as ClubRole]));
};

export const getPendingRequestClubIds = async (
  supabaseClient: SupabaseClient,
  userId: string,
): Promise<Set<string>> => {
  const { data, error } = await supabaseClient
    .from("book_club_join_requests")
    .select("club_id")
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) throw error;
  return new Set((data || []).map((row) => row.club_id as string));
};

export const getPendingInviteClubIds = async (
  supabaseClient: SupabaseClient,
  userId: string,
): Promise<Set<string>> => {
  const { data, error } = await supabaseClient
    .from("book_club_invites")
    .select("club_id")
    .eq("invited_user_id", userId)
    .eq("status", "pending");
  if (error) throw error;
  return new Set((data || []).map((row) => row.club_id as string));
};

export const canViewFullClub = (
  club: ClubRow,
  userId: string,
  role?: ClubRole | null,
): boolean => {
  return !club.is_private || club.created_by === userId || Boolean(role);
};

export const getDistanceKm = (club: ClubRow, viewer: ViewerContext): number | undefined => {
  if (
    !viewer.showLocation ||
    typeof viewer.latitude !== "number" ||
    typeof viewer.longitude !== "number" ||
    typeof club.latitude !== "number" ||
    typeof club.longitude !== "number"
  ) {
    return undefined;
  }
  return calculateDistance(viewer.latitude, viewer.longitude, club.latitude, club.longitude);
};

export const scoreClub = (
  club: ClubRow,
  viewer: ViewerContext,
  sharedMemberCount = 0,
): number => {
  let score = 0;
  const memberCount = club.member_count || 0;
  score += Math.min(memberCount * 2, 80);

  if (club.last_activity_at) {
    const ageDays = Math.max(
      0,
      (Date.now() - new Date(club.last_activity_at).getTime()) / 86_400_000,
    );
    score += Math.max(0, 40 - ageDays);
  }

  const terms = [...(club.genres || []), ...(club.tags || [])];
  const overlap = terms.filter((term) => viewer.userGenres.has(term)).length;
  score += overlap * 25;
  score += sharedMemberCount * 18;

  const distanceKm = getDistanceKm(club, viewer);
  if (typeof distanceKm === "number") score += Math.max(0, 35 - distanceKm * 0.5);
  if (club.is_private) score -= 5;
  return score;
};

export const normalizeClubPreview = (
  club: ClubRow,
  viewer: ViewerContext,
  role: ClubRole | null,
  options: {
    currentBook?: Record<string, unknown> | null;
    bannerImageUrl?: string | null;
    avatarImageUrl?: string | null;
    joinStatus?: ClubJoinStatus;
    requestId?: string | null;
    inviteId?: string | null;
    recommendationScore?: number;
    recommendationReason?: string;
    sharedMemberCount?: number;
  } = {},
) => {
  const fullAccess = canViewFullClub(club, viewer.userId, role);
  const distanceKm = getDistanceKm(club, viewer);
  return {
    id: club.id,
    name: club.name,
    description: club.description,
    created_by: club.created_by,
    cover_image_url: club.cover_image_url,
    banner_image_path: fullAccess ? club.banner_image_path : null,
    avatar_image_path: fullAccess ? club.avatar_image_path : null,
    banner_image_url: options.bannerImageUrl || null,
    avatar_image_url: options.avatarImageUrl || club.cover_image_url || null,
    is_private: Boolean(club.is_private),
    preview_only: !fullAccess,
    city: club.city,
    country: club.country,
    latitude: fullAccess ? club.latitude : null,
    longitude: fullAccess ? club.longitude : null,
    genres: club.genres || [],
    tags: club.tags || [],
    member_limit: club.member_limit,
    member_count: club.member_count || 0,
    discussion_count: fullAccess ? club.discussion_count || 0 : 0,
    announcement_count: fullAccess ? club.announcement_count || 0 : 0,
    last_activity_at: fullAccess ? club.last_activity_at : null,
    created_at: club.created_at,
    updated_at: club.updated_at,
    user_role: role,
    join_status: options.joinStatus || (role ? "member" : "none"),
    request_id: options.requestId || null,
    invite_id: options.inviteId || null,
    distance_km: distanceKm,
    shared_member_count: options.sharedMemberCount || 0,
    recommendation_score: options.recommendationScore || 0,
    recommendation_reason: options.recommendationReason || null,
    current_book: fullAccess ? options.currentBook || null : null,
  };
};

export const requireClubRole = async (
  supabaseClient: SupabaseClient,
  clubId: string,
  userId: string,
  allowedRoles: ClubRole[],
) => {
  const { data, error } = await supabaseClient
    .from("book_club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const role = data?.role as ClubRole | undefined;
  if (!role || !allowedRoles.includes(role)) {
    throw new Error("You do not have permission to manage this club");
  }
  return role;
};

export const getClubOr404 = async (supabaseClient: SupabaseClient, clubId: string) => {
  const { data, error } = await supabaseClient
    .from("book_clubs")
    .select(ACTIVE_CLUB_SELECT)
    .eq("id", clubId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Club not found");
  return data as ClubRow;
};

export const isBlockedRelation = async (
  supabaseClient: SupabaseClient,
  a: string,
  b: string,
): Promise<boolean> => {
  const { data, error } = await supabaseClient
    .from("user_blocks")
    .select("id")
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
};
