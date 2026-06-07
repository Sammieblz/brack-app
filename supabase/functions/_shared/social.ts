import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

export type FeedCursor = {
  source: "timeline" | "discovery" | "activity";
  created_at: string;
  id: string;
};

export const encodeCursor = (cursor: FeedCursor | null): string | null => {
  if (!cursor) return null;
  return btoa(JSON.stringify(cursor));
};

export const decodeCursor = (value: unknown): FeedCursor | null => {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(atob(value)) as FeedCursor;
    if (!parsed.source || !parsed.created_at || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clampLimit = (value: unknown, fallback = 20, max = 30): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
};

export const sanitizeString = (value: unknown, maxLength: number): string => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

export const getBlockedUserIds = async (
  supabaseClient: SupabaseClient,
  userId: string
): Promise<Set<string>> => {
  const { data, error } = await supabaseClient
    .from("user_blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  if (error) throw error;

  const ids = new Set<string>();
  for (const block of data || []) {
    if (block.blocker_id === userId) ids.add(block.blocked_id);
    if (block.blocked_id === userId) ids.add(block.blocker_id);
  }
  return ids;
};

export const getFollowingIds = async (
  supabaseClient: SupabaseClient,
  userId: string
): Promise<Set<string>> => {
  const { data, error } = await supabaseClient
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", userId);

  if (error) throw error;
  return new Set((data || []).map((row) => row.following_id as string));
};

export const isVisiblePostForUser = (
  post: Record<string, unknown>,
  viewerId: string,
  followingIds: Set<string>,
  blockedIds: Set<string>
): boolean => {
  const actorId = String(post.user_id || "");
  const visibility = String(post.visibility || "public");
  if (!actorId || blockedIds.has(actorId) || post.deleted_at) return false;
  if (actorId === viewerId) return true;
  if (visibility === "public") return true;
  return visibility === "followers" && followingIds.has(actorId);
};

export const applyCursor = <T>(
  query: T,
  createdColumn: string,
  idColumn: string,
  cursor: FeedCursor | null
): T => {
  if (!cursor) return query;
  return (query as {
    or: (filter: string) => T;
  }).or(
    `${createdColumn}.lt.${cursor.created_at},and(${createdColumn}.eq.${cursor.created_at},${idColumn}.lt.${cursor.id})`
  );
};

export const createPostUrl = (postId: string, origin: string | null): string => {
  const publicOrigin =
    Deno.env.get("PUBLIC_APP_URL") ||
    (origin && !origin.includes("localhost") ? origin : null) ||
    origin ||
    "http://localhost:8080";
  return `${publicOrigin.replace(/\/$/, "")}/posts/${postId}`;
};

const signMediaUrl = async (
  supabaseClient: SupabaseClient,
  path: string | null,
  expiresIn = 3600
): Promise<string | null> => {
  if (!path) return null;
  const { data, error } = await supabaseClient.storage
    .from("post-media")
    .createSignedUrl(path, expiresIn);
  if (error) {
    console.error("Failed to sign post media", error);
    return null;
  }
  return data?.signedUrl ?? null;
};

export const enrichPosts = async (
  supabaseClient: SupabaseClient,
  posts: Array<Record<string, unknown>>,
  viewerId: string,
  origin: string | null
) => {
  if (posts.length === 0) return [];

  const postIds = posts.map((post) => String(post.id));
  const userIds = [...new Set(posts.map((post) => String(post.user_id)).filter(Boolean))];
  const bookIds = [
    ...new Set(posts.map((post) => post.book_id).filter(Boolean).map(String)),
  ];
  const clubIds = [
    ...new Set(posts.map((post) => post.club_id).filter(Boolean).map(String)),
  ];

  const [
    profilesResult,
    booksResult,
    clubsResult,
    mediaResult,
    likesResult,
  ] = await Promise.all([
    userIds.length
      ? supabaseClient
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    bookIds.length
      ? supabaseClient
          .from("books")
          .select("id, title, author, cover_url")
          .in("id", bookIds)
      : Promise.resolve({ data: [], error: null }),
    clubIds.length
      ? supabaseClient
          .from("book_clubs")
          .select("id, name, description, cover_image_url, is_private")
          .in("id", clubIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseClient
      .from("post_media")
      .select("*")
      .in("post_id", postIds)
      .order("position", { ascending: true }),
    supabaseClient
      .from("post_likes")
      .select("post_id")
      .eq("user_id", viewerId)
      .in("post_id", postIds),
  ]);

  for (const result of [
    profilesResult,
    booksResult,
    clubsResult,
    mediaResult,
    likesResult,
  ]) {
    if (result.error) throw result.error;
  }

  const profileMap = new Map((profilesResult.data || []).map((row) => [row.id, row]));
  const bookMap = new Map((booksResult.data || []).map((row) => [row.id, row]));
  const clubMap = new Map((clubsResult.data || []).map((row) => [row.id, row]));
  const likedIds = new Set((likesResult.data || []).map((row) => row.post_id as string));

  const mediaByPost = new Map<string, Array<Record<string, unknown>>>();
  for (const media of mediaResult.data || []) {
    const signedUrl = await signMediaUrl(supabaseClient, media.storage_path);
    const thumbnailUrl = await signMediaUrl(supabaseClient, media.thumbnail_path);
    const normalized = {
      ...media,
      signed_url: signedUrl,
      thumbnail_url: thumbnailUrl,
    };
    const group = mediaByPost.get(media.post_id) || [];
    group.push(normalized);
    mediaByPost.set(media.post_id, group);
  }

  return posts.map((post) => ({
    ...post,
    user: profileMap.get(String(post.user_id)) ?? null,
    book: post.book_id ? bookMap.get(String(post.book_id)) ?? null : null,
    club: post.club_id ? clubMap.get(String(post.club_id)) ?? null : null,
    media: mediaByPost.get(String(post.id)) || [],
    user_has_liked: likedIds.has(String(post.id)),
    share_url: createPostUrl(String(post.id), origin),
  }));
};

export const enrichActivities = async (
  supabaseClient: SupabaseClient,
  activities: Array<Record<string, unknown>>
) => {
  if (activities.length === 0) return [];

  const userIds = [
    ...new Set(activities.map((activity) => String(activity.user_id)).filter(Boolean)),
  ];
  const bookIds = [
    ...new Set(activities.map((activity) => activity.book_id).filter(Boolean).map(String)),
  ];

  const [profilesResult, booksResult] = await Promise.all([
    userIds.length
      ? supabaseClient
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    bookIds.length
      ? supabaseClient
          .from("books")
          .select("id, title, author, cover_url")
          .in("id", bookIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (booksResult.error) throw booksResult.error;

  const profileMap = new Map((profilesResult.data || []).map((row) => [row.id, row]));
  const bookMap = new Map((booksResult.data || []).map((row) => [row.id, row]));

  return activities.map((activity) => ({
    ...activity,
    user: profileMap.get(String(activity.user_id)) ?? null,
    book: activity.book_id ? bookMap.get(String(activity.book_id)) ?? null : null,
  }));
};
