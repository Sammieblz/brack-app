import { getApiErrorStatus } from "@/services/api/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileLayout } from "@/components/MobileLayout";
import { NativeHeader } from "@/components/NativeHeader";
import { PostCard } from "@/components/social/PostCard";
import { PostCardSkeleton } from "@/components/skeletons/PostCardSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_ICONS } from "@/config/iconography";
import { useIsMobile } from "@/hooks/use-mobile";
import { getPostById, togglePostLike, type Post } from "@/services/api";
import { toast } from "sonner";
import { LoadingError, LoadingRegion } from "@/components/loading/LoadingRegion";

const PostDetail = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activePost = useRef(postId);
  activePost.current = postId;
  const request = useRef(0);

  const loadPost = useCallback(async () => {
    if (!postId) { setLoading(false); return; }
    const requestId = ++request.current;
    try {
      setLoading(true);
      setError(null);
      const result = await getPostById(postId);
      if (activePost.current !== postId || request.current !== requestId) return;
      setPost(result);
      setLoadedId(postId);
    } catch (error) {
      if (activePost.current !== postId || request.current !== requestId) return;
      if ([401, 403, 404].includes(getApiErrorStatus(error) ?? 0)) { setPost(null); setLoadedId(null); }
      console.error("Failed to load post", error);
      toast.error("Failed to load post");
      setError("We couldn't load this post. Please try again.");
    } finally {
      if (activePost.current === postId && request.current === requestId) setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    setPost(null);
    setLoadedId(null);
    setError(null);
    loadPost();
    return () => { request.current += 1; };
  }, [loadPost]);

  const handleLike = async () => {
    if (!post) return;
    const previous = post;
    setPost({
      ...post,
      user_has_liked: !post.user_has_liked,
      likes_count: Math.max(0, post.likes_count + (post.user_has_liked ? -1 : 1)),
    });
    try {
      const result = await togglePostLike(post.id);
      setPost({ ...post, user_has_liked: result.liked, likes_count: result.likes_count });
    } catch (error) {
      setPost(previous);
      toast.error("Failed to update like");
    }
  };

  return (
    <MobileLayout>
      {isMobile ? (
        <MobileHeader title="Post" back={{ fallbackPath: "/feed" }} />
      ) : (
        <NativeHeader
          title="Post"
          subtitle="Shared reading conversation"
          back={{ fallbackPath: "/feed", label: "Feed" }}
          showUtilityActions
        />
      )}

      <main className="app-page max-w-3xl">
        <LoadingRegion loading={loading && loadedId !== postId} refreshing={loading && loadedId === postId} label="Loading post">
        {error && <LoadingError message={error} onRetry={loadPost} />}
        {loading && loadedId !== postId ? (
          <PostCardSkeleton />
        ) : loadedId !== postId ? null : post ? (
          <PostCard
            post={post}
            onLike={handleLike}
            onDelete={() => navigate("/feed")}
            onBlocked={() => navigate("/feed")}
          />
        ) : (
          <Card>
            <CardContent className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
              <APP_ICONS.profile.posts className="mb-4 h-10 w-10 text-muted-foreground" />
              <h1 className="font-display text-xl font-semibold">Post unavailable</h1>
              <p className="mt-2 max-w-sm font-sans text-sm text-muted-foreground">
                This post may have been deleted, made private, or hidden by privacy settings.
              </p>
              <Button className="mt-4" onClick={() => navigate("/feed")}>
                Back to Feed
              </Button>
            </CardContent>
          </Card>
        )}
        </LoadingRegion>
      </main>
    </MobileLayout>
  );
};

export default PostDetail;
