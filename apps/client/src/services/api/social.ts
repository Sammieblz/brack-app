import { invokeFunction } from "./client";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeInput } from "@/utils/sanitize";
import { getCurrentAuthUser } from "./auth";
import type { RichTextDocument, RichTextFormat } from "@/types/richText";

export type SocialActivityType =
  | "book_started"
  | "book_completed"
  | "book_reviewed"
  | "followed_user"
  | "created_list"
  | "earned_badge"
  | "post";

export interface FeedActivity {
  id: string;
  user_id: string;
  activity_type: SocialActivityType;
  book_id?: string | null;
  review_id?: string | null;
  list_id?: string | null;
  badge_id?: string | null;
  metadata?: Record<string, unknown> | null;
  visibility: string | null;
  created_at: string;
  user?: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
  } | null;
  book?: {
    id: string;
    title: string;
    author?: string | null;
    cover_url?: string | null;
  } | null;
}

export interface SocialFeedResponse {
  activities: FeedActivity[];
  next_cursor?: string | null;
  has_more: boolean;
  caught_up?: boolean;
}

export type PostType = "text" | "book" | "club";
export type PostVisibility = "public" | "followers" | "private";
export type PostMediaType = "image" | "video";

export interface PostMedia {
  id?: string;
  post_id?: string;
  storage_path: string;
  signed_url?: string | null;
  thumbnail_path?: string | null;
  thumbnail_url?: string | null;
  media_type: PostMediaType;
  mime_type: string;
  size_bytes: number;
  width?: number | null;
  height?: number | null;
  duration_ms?: number | null;
  position?: number;
}

export interface Post {
  id: string;
  user_id: string;
  book_id?: string | null;
  club_id?: string | null;
  title: string;
  content: string;
  content_format?: RichTextFormat | null;
  content_json?: RichTextDocument | null;
  content_html?: string | null;
  genre?: string | null;
  post_type: PostType;
  visibility: PostVisibility;
  likes_count: number;
  comments_count: number;
  share_count: number;
  metadata?: Record<string, unknown> | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
  } | null;
  book?: {
    id: string;
    title: string;
    author?: string | null;
    cover_url?: string | null;
  } | null;
  club?: {
    id: string;
    name: string;
    description?: string | null;
    cover_image_url?: string | null;
    is_private?: boolean | null;
  } | null;
  media?: PostMedia[];
  user_has_liked?: boolean;
  share_url?: string;
}

export interface PostsFeedResponse {
  items: Post[];
  next_cursor?: string | null;
  has_more: boolean;
  feed_mode: "following" | "discovery" | "mixed" | "caught_up" | "detail";
  caught_up: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string | null;
  root_comment_id?: string | null;
  content: string;
  depth: number;
  reply_count: number;
  deleted_at?: string | null;
  is_deleted?: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
  } | null;
  replies?: PostComment[];
}

export interface PostCommentsResponse {
  comments: PostComment[];
  next_cursor?: string | null;
  has_more: boolean;
}

export interface CreatePostRequest {
  title: string;
  content: string;
  content_format?: RichTextFormat;
  content_json?: RichTextDocument | null;
  content_html?: string | null;
  genre?: string | null;
  post_type?: PostType;
  visibility?: PostVisibility;
  book_id?: string | null;
  club_id?: string | null;
  media?: PostMedia[];
}

export interface CreateCommunityPostRequest {
  title: string;
  content: string;
  genre?: string | null;
}

export interface BlockedUser {
  id: string;
  user_id: string;
  created_at: string;
  user?: {
    id: string;
    display_name: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface SharePostResponse {
  share_url: string;
  share_count: number;
}

const POST_MEDIA_BUCKET = "post-media";
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

const toSafeFileName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "media";

export const getPostsFeed = async (
  cursor?: string | null,
  limit = 20
): Promise<PostsFeedResponse> => {
  return invokeFunction<PostsFeedResponse>("posts-feed", {
    body: { cursor, limit },
  });
};

export const getPostById = async (postId: string): Promise<Post | null> => {
  const response = await invokeFunction<PostsFeedResponse>("posts-feed", {
    body: { post_id: postId, limit: 1 },
  });
  return response.items[0] ?? null;
};

export const getSocialFeed = async (
  limit = 20,
  cursor?: string | null
): Promise<SocialFeedResponse> => {
  return invokeFunction<SocialFeedResponse>("social-feed", {
    body: { limit, cursor },
  });
};

export const uploadPostMediaFiles = async (files: File[]): Promise<PostMedia[]> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const imageCount = files.filter((file) => IMAGE_MIME_TYPES.has(file.type)).length;
  const videoCount = files.filter((file) => VIDEO_MIME_TYPES.has(file.type)).length;

  if (imageCount > 4) throw new Error("Posts can include up to 4 images");
  if (videoCount > 1) throw new Error("Posts can include up to 1 video");
  if (imageCount > 0 && videoCount > 0) {
    throw new Error("Use either images or one video per post");
  }

  const uploaded: PostMedia[] = [];

  for (const [index, file] of files.entries()) {
    const isImage = IMAGE_MIME_TYPES.has(file.type);
    const isVideo = VIDEO_MIME_TYPES.has(file.type);
    if (!isImage && !isVideo) {
      throw new Error(`${file.name} is not a supported media type`);
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      throw new Error(`${file.name} must be 10 MB or smaller`);
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      throw new Error(`${file.name} must be 60 MB or smaller`);
    }

    const storagePath = `${user.id}/${crypto.randomUUID()}-${toSafeFileName(file.name)}`;
    const { error } = await supabase.storage
      .from(POST_MEDIA_BUCKET)
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

export const createPost = async (payload: CreatePostRequest): Promise<Post> => {
  const response = await invokeFunction<{ post: Post; post_id: string }>("create-post", {
    body: {
      ...payload,
      title: sanitizeInput(payload.title),
      content: sanitizeInput(payload.content),
      rich_text: {
        content_format: payload.content_format,
        content_json: payload.content_json,
        content_html: payload.content_html,
      },
    },
  });
  return response.post;
};

export const createCommunityPost = async ({
  title,
  content,
  genre,
}: CreateCommunityPostRequest): Promise<void> => {
  await createPost({ title, content, genre, post_type: "text", visibility: "public" });
};

export const fetchPosts = async (): Promise<Post[]> => {
  const response = await getPostsFeed(null, 20);
  return response.items;
};

export const createSocialActivityPost = async (): Promise<void> => {
  // Post activity is now generated by the posts database trigger.
};

export const togglePostLike = async (
  postOrId: Post | string
): Promise<{ liked: boolean; likes_count: number }> => {
  const postId = typeof postOrId === "string" ? postOrId : postOrId.id;
  return invokeFunction("toggle-post-like", { body: { post_id: postId } });
};

export const sharePost = async (
  postId: string,
  target?: string
): Promise<SharePostResponse> => {
  return invokeFunction<SharePostResponse>("share-post", {
    body: { post_id: postId, target },
  });
};

export const deletePost = async (postId: string): Promise<void> => {
  const { error } = await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw error;
};

export const fetchPostComments = async (
  postId: string,
  parentId?: string | null,
  cursor?: string | null,
  limit = 20
): Promise<PostCommentsResponse> => {
  return invokeFunction<PostCommentsResponse>("post-comments", {
    body: { post_id: postId, parent_id: parentId, cursor, limit },
  });
};

export const addPostComment = async (
  postId: string,
  content: string,
  parentId?: string
): Promise<PostComment> => {
  const response = await invokeFunction<{ comment: PostComment }>("create-post-comment", {
    body: {
      post_id: postId,
      parent_id: parentId || null,
      content: sanitizeInput(content),
    },
  });
  return response.comment;
};

export const deletePostComment = async (commentId: string): Promise<void> => {
  const { error } = await supabase
    .from("post_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) throw error;
};

export const blockUser = async (userId: string): Promise<void> => {
  await invokeFunction("block-user", { body: { user_id: userId } });
};

export const unblockUser = async (userId: string): Promise<void> => {
  await invokeFunction("unblock-user", { body: { user_id: userId } });
};

export const getBlockedUsers = async (): Promise<BlockedUser[]> => {
  const response = await invokeFunction<{ users: BlockedUser[] }>("blocked-users");
  return response.users;
};

export const subscribeToPosts = (): (() => void) => {
  return () => undefined;
};

export const subscribeToPostComments = (
  postId: string,
  onChange: () => void
): (() => void) => {
  const channel = supabase
    .channel(`post-comments-${postId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "post_comments",
        filter: `post_id=eq.${postId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToSocialFeed = (): (() => void) => {
  return () => undefined;
};
