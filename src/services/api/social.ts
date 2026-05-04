import { invokeFunction } from "./client";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeInput } from "@/utils/sanitize";
import { getCurrentAuthUser } from "./auth";

export interface FeedActivity {
  id: string;
  user_id: string;
  activity_type:
    | "book_started"
    | "book_completed"
    | "book_reviewed"
    | "followed_user"
    | "created_list"
    | "earned_badge"
    | "post";
  book_id?: string;
  review_id?: string;
  list_id?: string;
  badge_id?: string;
  metadata?: Record<string, unknown>;
  visibility: string;
  created_at: string;
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
  book?: {
    id: string;
    title: string;
    author?: string;
    cover_url?: string;
  };
}

export interface SocialFeedResponse {
  activities: FeedActivity[];
  has_more: boolean;
}

export const getSocialFeed = async (
  limit: number,
  offset: number
): Promise<SocialFeedResponse> => {
  return invokeFunction<SocialFeedResponse>("social-feed", {
    body: { limit, offset },
  });
};

export interface Post {
  id: string;
  user_id: string;
  book_id?: string | null;
  title: string;
  content: string;
  genre?: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
  };
  book?: {
    id: string;
    title: string;
    author?: string | null;
    cover_url?: string | null;
  };
  user_has_liked?: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id?: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    display_name: string;
    avatar_url?: string | null;
  };
  replies?: PostComment[];
}

export interface CreateCommunityPostRequest {
  title: string;
  content: string;
  genre?: string | null;
}

export const createSocialActivityPost = async (
  content: string,
  bookId?: string
): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("social_activities").insert({
    user_id: user.id,
    activity_type: "post",
    book_id: bookId || null,
    metadata: { content: sanitizeInput(content) },
    visibility: "public",
  });

  if (error) throw error;
};

export const fetchPosts = async (): Promise<Post[]> => {
  const user = await getCurrentAuthUser();

  const { data: postsData, error: postsError } = await supabase
    .from("posts")
    .select(
      `
      *,
      profiles:user_id (
        id,
        display_name,
        avatar_url
      ),
      books:book_id (
        id,
        title,
        author,
        cover_url
      )
    `
    )
    .order("created_at", { ascending: false });

  if (postsError) throw postsError;

  let likedPostIds: string[] = [];
  if (user) {
    const { data: likesData } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", user.id);

    likedPostIds = likesData?.map((like) => like.post_id) || [];
  }

  return (postsData || []).map((post) => ({
    id: post.id,
    user_id: post.user_id,
    book_id: post.book_id,
    title: post.title,
    content: post.content,
    genre: post.genre,
    likes_count: post.likes_count,
    comments_count: post.comments_count,
    created_at: post.created_at,
    updated_at: post.updated_at,
    user: post.profiles
      ? {
          id: post.profiles.id,
          display_name: post.profiles.display_name,
          avatar_url: post.profiles.avatar_url,
        }
      : undefined,
    book: post.books
      ? {
          id: post.books.id,
          title: post.books.title,
          author: post.books.author,
          cover_url: post.books.cover_url,
        }
      : undefined,
    user_has_liked: likedPostIds.includes(post.id),
  }));
};

export const createCommunityPost = async ({
  title,
  content,
  genre,
}: CreateCommunityPostRequest): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    title: sanitizeInput(title),
    content: sanitizeInput(content),
    genre: genre || null,
  });

  if (error) throw error;
};

export const createPostRecord = async (
  data: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabase.from("posts").insert(data);

  if (error) throw error;
};

export const updatePostRecord = async (
  postId: string,
  updates: Record<string, unknown>
): Promise<void> => {
  const { error } = await supabase.from("posts").update(updates).eq("id", postId);

  if (error) throw error;
};

export const togglePostLike = async (post: Post): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  if (post.user_has_liked) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", post.id)
      .eq("user_id", user.id);

    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("post_likes")
    .insert({ post_id: post.id, user_id: user.id });

  if (error) throw error;
};

export const deletePost = async (postId: string): Promise<void> => {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
};

export const fetchPostComments = async (
  postId: string
): Promise<PostComment[]> => {
  const { data, error } = await supabase
    .from("post_comments")
    .select(
      `
      *,
      profiles:user_id (
        id,
        display_name,
        avatar_url
      )
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const commentMap = new Map<string, PostComment>();
  const rootComments: PostComment[] = [];

  data?.forEach((comment) => {
    const commentObj: PostComment = {
      id: comment.id,
      post_id: comment.post_id,
      user_id: comment.user_id,
      parent_id: comment.parent_id,
      content: comment.content,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      user: comment.profiles
        ? {
            id: comment.profiles.id,
            display_name: comment.profiles.display_name,
            avatar_url: comment.profiles.avatar_url,
          }
        : undefined,
      replies: [],
    };

    commentMap.set(comment.id, commentObj);

    if (!comment.parent_id) {
      rootComments.push(commentObj);
    }
  });

  commentMap.forEach((comment) => {
    if (!comment.parent_id) return;

    const parent = commentMap.get(comment.parent_id);
    if (parent) {
      parent.replies = parent.replies || [];
      parent.replies.push(comment);
    }
  });

  return rootComments;
};

export const addPostComment = async (
  postId: string,
  content: string,
  parentId?: string
): Promise<void> => {
  const user = await getCurrentAuthUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("post_comments").insert({
    post_id: postId,
    user_id: user.id,
    parent_id: parentId,
    content: sanitizeInput(content),
  });

  if (error) throw error;
};

export const deletePostComment = async (commentId: string): Promise<void> => {
  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId);

  if (error) throw error;
};

export const subscribeToPosts = (onChange: () => void): (() => void) => {
  const channel = supabase
    .channel("posts-changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "posts",
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
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

export const subscribeToSocialFeed = (onChange: () => void): (() => void) => {
  const channel = supabase
    .channel("social-feed-changes")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "social_activities",
      },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
