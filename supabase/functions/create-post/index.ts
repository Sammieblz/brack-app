import {
  createServiceClient,
  getAuthenticatedUser,
  jsonResponse,
  optionsResponse,
  parseJsonBody,
} from "../_shared/appEndpoint.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { normalizeRichText, type RichTextPayload } from "../_shared/richText.ts";
import { sanitizeString } from "../_shared/social.ts";

type PostType = "text" | "book" | "club";
type MediaType = "image" | "video";

interface CreatePostMediaInput {
  storage_path?: unknown;
  media_type?: unknown;
  mime_type?: unknown;
  size_bytes?: unknown;
  width?: unknown;
  height?: unknown;
  duration_ms?: unknown;
  thumbnail_path?: unknown;
}

interface CreatePostBody {
  title?: unknown;
  content?: unknown;
  genre?: unknown;
  post_type?: unknown;
  visibility?: unknown;
  book_id?: unknown;
  club_id?: unknown;
  media?: CreatePostMediaInput[];
  content_format?: unknown;
  content_json?: unknown;
  content_html?: unknown;
  rich_text?: RichTextPayload;
}

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const MAX_VIDEO_MS = 90_000;

const asNullableUuid = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const assertOwnedStoragePath = (userId: string, path: string): void => {
  if (!path.startsWith(`${userId}/`)) {
    throw new Error("Media path is not owned by the authenticated user");
  }
};

const normalizeMedia = (
  userId: string,
  media: CreatePostMediaInput[] | undefined
) => {
  const items = Array.isArray(media) ? media : [];
  const imageCount = items.filter((item) => item.media_type === "image").length;
  const videoCount = items.filter((item) => item.media_type === "video").length;

  if (imageCount > 4) throw new Error("Posts can include up to 4 images");
  if (videoCount > 1) throw new Error("Posts can include up to 1 video");
  if (videoCount > 0 && imageCount > 0) {
    throw new Error("Use either images or one video per post");
  }

  return items.map((item, index) => {
    const storagePath = sanitizeString(item.storage_path, 500);
    const thumbnailPath = sanitizeString(item.thumbnail_path, 500) || null;
    const mediaType = String(item.media_type || "") as MediaType;
    const mimeType = sanitizeString(item.mime_type, 100);
    const sizeBytes = Number(item.size_bytes || 0);
    const durationMs = item.duration_ms == null ? null : Number(item.duration_ms);

    if (!storagePath) throw new Error("Media path is required");
    assertOwnedStoragePath(userId, storagePath);
    if (thumbnailPath) assertOwnedStoragePath(userId, thumbnailPath);

    if (mediaType === "image") {
      if (!IMAGE_MIME_TYPES.has(mimeType)) throw new Error("Unsupported image type");
      if (sizeBytes <= 0 || sizeBytes > MAX_IMAGE_BYTES) {
        throw new Error("Images must be 10 MB or smaller");
      }
    } else if (mediaType === "video") {
      if (!VIDEO_MIME_TYPES.has(mimeType)) throw new Error("Unsupported video type");
      if (sizeBytes <= 0 || sizeBytes > MAX_VIDEO_BYTES) {
        throw new Error("Videos must be 60 MB or smaller");
      }
      if (durationMs != null && durationMs > MAX_VIDEO_MS) {
        throw new Error("Videos must be 90 seconds or shorter");
      }
    } else {
      throw new Error("Unsupported media type");
    }

    return {
      storage_path: storagePath,
      media_type: mediaType,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      width: item.width == null ? null : Number(item.width),
      height: item.height == null ? null : Number(item.height),
      duration_ms: durationMs,
      thumbnail_path: thumbnailPath,
      position: index,
    };
  });
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return optionsResponse(origin);
  }

  try {
    const supabaseClient = createServiceClient();
    const authResult = await getAuthenticatedUser(req, supabaseClient, origin);
    if ("response" in authResult) return authResult.response;

    const limited = await enforceRateLimit(req, supabaseClient, {
      name: "create-post",
      identifier: authResult.user.id,
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await parseJsonBody<CreatePostBody>(req);
    const title = sanitizeString(body.title, 200);
    const richText = normalizeRichText(
      body.rich_text || {
        content_format: body.content_format,
        content_json: body.content_json,
        content_html: body.content_html,
      },
      body.content,
      10_000,
    );
    const content = richText.text;
    const genre = sanitizeString(body.genre, 100) || null;
    const postType = (body.post_type === "book" || body.post_type === "club"
      ? body.post_type
      : "text") as PostType;
    const visibility =
      body.visibility === "followers" || body.visibility === "private"
        ? body.visibility
        : "public";
    const bookId = asNullableUuid(body.book_id);
    const clubId = asNullableUuid(body.club_id);
    const media = normalizeMedia(authResult.user.id, body.media);

    if (!title || !content) {
      return jsonResponse({ error: "Title and content are required" }, 400, origin);
    }
    if (postType === "book" && !bookId) {
      return jsonResponse({ error: "Book posts require a book" }, 400, origin);
    }
    if (postType === "club" && !clubId) {
      return jsonResponse({ error: "Club posts require a club" }, 400, origin);
    }

    if (bookId) {
      const { data: book, error } = await supabaseClient
        .from("books")
        .select("id,user_id")
        .eq("id", bookId)
        .maybeSingle();
      if (error) throw error;
      if (!book || book.user_id !== authResult.user.id) {
        return jsonResponse({ error: "Book not found" }, 404, origin);
      }
    }

    if (clubId) {
      const { data: membership, error } = await supabaseClient
        .from("book_club_members")
        .select("id")
        .eq("club_id", clubId)
        .eq("user_id", authResult.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!membership) {
        return jsonResponse({ error: "Club not found" }, 404, origin);
      }
    }

    const { data: post, error: postError } = await supabaseClient
      .from("posts")
      .insert({
        user_id: authResult.user.id,
        title,
        content,
        content_format: richText.content_format,
        content_json: richText.content_json,
        content_html: richText.content_html,
        genre,
        post_type: postType,
        visibility,
        book_id: postType === "book" ? bookId : null,
        club_id: postType === "club" ? clubId : null,
        metadata: {
          media_count: media.length,
        },
      })
      .select("*")
      .single();

    if (postError) throw postError;

    if (media.length > 0) {
      const { error: mediaError } = await supabaseClient.from("post_media").insert(
        media.map((item) => ({
          ...item,
          post_id: post.id,
          user_id: authResult.user.id,
        }))
      );
      if (mediaError) throw mediaError;
    }

    return jsonResponse({ post_id: post.id, post }, 201, origin);
  } catch (error) {
    console.error("create-post failed", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Failed to create post" },
      500,
      origin
    );
  }
});
