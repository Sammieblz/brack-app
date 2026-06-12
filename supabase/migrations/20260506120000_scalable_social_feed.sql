-- Scalable social feed, media posts, threaded comments, sharing, and blocking.

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'text',
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public',
ADD COLUMN IF NOT EXISTS club_id UUID NULL,
ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE public.posts
DROP CONSTRAINT IF EXISTS posts_post_type_check;

ALTER TABLE public.posts
ADD CONSTRAINT posts_post_type_check
CHECK (post_type IN ('text', 'book', 'club'));

ALTER TABLE public.posts
DROP CONSTRAINT IF EXISTS posts_visibility_check;

ALTER TABLE public.posts
ADD CONSTRAINT posts_visibility_check
CHECK (visibility IN ('public', 'followers', 'private'));

ALTER TABLE public.posts
DROP CONSTRAINT IF EXISTS posts_club_id_fkey;

ALTER TABLE public.posts
ADD CONSTRAINT posts_club_id_fkey
FOREIGN KEY (club_id) REFERENCES public.book_clubs(id) ON DELETE SET NULL;

ALTER TABLE public.post_comments
ADD COLUMN IF NOT EXISTS root_comment_id UUID NULL,
ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS reply_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL DEFAULT 'post-media',
  storage_path TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  width INTEGER NULL,
  height INTEGER NULL,
  duration_ms INTEGER NULL,
  thumbnail_path TEXT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, storage_path)
);

CREATE TABLE IF NOT EXISTS public.post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  share_target TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.post_feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'following' CHECK (source IN ('self', 'following')),
  item_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (viewer_id, post_id)
);

CREATE TABLE IF NOT EXISTS public.activity_feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.social_activities(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (viewer_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_visible_created
ON public.posts(visibility, created_at DESC, id DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_user_created_active
ON public.posts(user_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_book_id
ON public.posts(book_id)
WHERE book_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_club_id
ON public.posts(club_id)
WHERE club_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_comments_roots
ON public.post_comments(post_id, created_at DESC, id DESC)
WHERE parent_id IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_comments_parent
ON public.post_comments(parent_id, created_at ASC, id ASC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_media_post_position
ON public.post_media(post_id, position);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_user
ON public.post_likes(post_id, user_id);

CREATE INDEX IF NOT EXISTS idx_post_shares_post
ON public.post_shares(post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_blocked
ON public.user_blocks(blocker_id, blocked_id);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_blocker
ON public.user_blocks(blocked_id, blocker_id);

CREATE INDEX IF NOT EXISTS idx_post_feed_viewer_created
ON public.post_feed_items(viewer_id, item_created_at DESC, post_id DESC);

CREATE INDEX IF NOT EXISTS idx_post_feed_post
ON public.post_feed_items(post_id);

CREATE INDEX IF NOT EXISTS idx_activity_feed_viewer_created
ON public.activity_feed_items(viewer_id, item_created_at DESC, activity_id DESC);

CREATE INDEX IF NOT EXISTS idx_activity_feed_actor
ON public.activity_feed_items(actor_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

DROP POLICY IF EXISTS "Users can upload their own post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can view post media" ON storage.objects;

CREATE POLICY "Users can upload their own post media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'post-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own post media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'post-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'post-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own post media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'post-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE OR REPLACE FUNCTION public.social_pair_blocked(p_user_a UUID, p_user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_blocks ub
    WHERE (ub.blocker_id = p_user_a AND ub.blocked_id = p_user_b)
       OR (ub.blocker_id = p_user_b AND ub.blocked_id = p_user_a)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_social_post(p_viewer UUID, p_post public.posts)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_post.deleted_at IS NULL
    AND NOT public.social_pair_blocked(p_viewer, p_post.user_id)
    AND (
      p_post.visibility = 'public'
      OR p_post.user_id = p_viewer
      OR (
        p_post.visibility = 'followers'
        AND EXISTS (
          SELECT 1
          FROM public.user_follows uf
          WHERE uf.follower_id = p_viewer
            AND uf.following_id = p_post.user_id
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.prepare_post_comment_thread()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent RECORD;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.root_comment_id := NULL;
    NEW.depth := 0;
    RETURN NEW;
  END IF;

  SELECT id, post_id, root_comment_id, depth
  INTO v_parent
  FROM public.post_comments
  WHERE id = NEW.parent_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent comment not found';
  END IF;

  IF v_parent.post_id <> NEW.post_id THEN
    RAISE EXCEPTION 'Reply must belong to the same post';
  END IF;

  IF v_parent.depth >= 8 THEN
    RAISE EXCEPTION 'Comment thread is too deep';
  END IF;

  NEW.root_comment_id := COALESCE(v_parent.root_comment_id, v_parent.id);
  NEW.depth := v_parent.depth + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_post_comment_thread_trigger ON public.post_comments;
CREATE TRIGGER prepare_post_comment_thread_trigger
BEFORE INSERT ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION public.prepare_post_comment_thread();

CREATE OR REPLACE FUNCTION public.update_post_reply_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
    UPDATE public.post_comments
    SET reply_count = reply_count + 1
    WHERE id = NEW.parent_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
    UPDATE public.post_comments
    SET reply_count = GREATEST(reply_count - 1, 0)
    WHERE id = OLD.parent_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS update_post_reply_count_trigger ON public.post_comments;
CREATE TRIGGER update_post_reply_count_trigger
AFTER INSERT OR DELETE ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_post_reply_count();

CREATE OR REPLACE FUNCTION public.update_post_shares_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET share_count = share_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;

  UPDATE public.posts
  SET share_count = GREATEST(share_count - 1, 0)
  WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS update_post_shares_count_trigger ON public.post_shares;
CREATE TRIGGER update_post_shares_count_trigger
AFTER INSERT OR DELETE ON public.post_shares
FOR EACH ROW
EXECUTE FUNCTION public.update_post_shares_count();

CREATE OR REPLACE FUNCTION public.fanout_post_feed_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.visibility = 'private' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.post_feed_items (viewer_id, post_id, actor_id, source, item_created_at)
  VALUES (NEW.user_id, NEW.id, NEW.user_id, 'self', NEW.created_at)
  ON CONFLICT (viewer_id, post_id) DO NOTHING;

  INSERT INTO public.post_feed_items (viewer_id, post_id, actor_id, source, item_created_at)
  SELECT uf.follower_id, NEW.id, NEW.user_id, 'following', NEW.created_at
  FROM public.user_follows uf
  WHERE uf.following_id = NEW.user_id
    AND NOT public.social_pair_blocked(uf.follower_id, NEW.user_id)
  ON CONFLICT (viewer_id, post_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fanout_post_feed_item_trigger ON public.posts;
CREATE TRIGGER fanout_post_feed_item_trigger
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.fanout_post_feed_item();

CREATE OR REPLACE FUNCTION public.fanout_social_activity_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE((SELECT show_reading_activity FROM public.profiles WHERE id = NEW.user_id), true) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.activity_feed_items (viewer_id, activity_id, actor_id, item_created_at)
  SELECT inbound.follower_id, NEW.id, NEW.user_id, NEW.created_at
  FROM public.user_follows inbound
  JOIN public.user_follows outbound
    ON outbound.follower_id = NEW.user_id
   AND outbound.following_id = inbound.follower_id
  WHERE inbound.following_id = NEW.user_id
    AND inbound.follower_id <> NEW.user_id
    AND NOT public.social_pair_blocked(inbound.follower_id, NEW.user_id)
  ON CONFLICT (viewer_id, activity_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fanout_social_activity_item_trigger ON public.social_activities;
CREATE TRIGGER fanout_social_activity_item_trigger
AFTER INSERT ON public.social_activities
FOR EACH ROW
EXECUTE FUNCTION public.fanout_social_activity_item();

CREATE OR REPLACE FUNCTION public.sync_activity_privacy_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.show_reading_activity, true) = true
    AND COALESCE(NEW.show_reading_activity, true) = false THEN
    DELETE FROM public.activity_feed_items
    WHERE actor_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_activity_privacy_items_trigger ON public.profiles;
CREATE TRIGGER sync_activity_privacy_items_trigger
AFTER UPDATE OF show_reading_activity ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_activity_privacy_items();

CREATE OR REPLACE FUNCTION public.cleanup_block_relationships()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_follows
  WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);

  DELETE FROM public.post_feed_items
  WHERE (viewer_id = NEW.blocker_id AND actor_id = NEW.blocked_id)
     OR (viewer_id = NEW.blocked_id AND actor_id = NEW.blocker_id);

  DELETE FROM public.activity_feed_items
  WHERE (viewer_id = NEW.blocker_id AND actor_id = NEW.blocked_id)
     OR (viewer_id = NEW.blocked_id AND actor_id = NEW.blocker_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_block_relationships_trigger ON public.user_blocks;
CREATE TRIGGER cleanup_block_relationships_trigger
AFTER INSERT ON public.user_blocks
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_block_relationships();

ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view posts" ON public.posts;
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;

CREATE POLICY "Visible social posts are readable"
ON public.posts FOR SELECT
USING (public.can_view_social_post(auth.uid(), posts));

CREATE POLICY "Users can create their own posts"
ON public.posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
ON public.posts FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
ON public.posts FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view comments" ON public.post_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.post_comments;

CREATE POLICY "Visible post comments are readable"
ON public.post_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_comments.post_id
      AND public.can_view_social_post(auth.uid(), p)
  )
);

CREATE POLICY "Users can create visible post comments"
ON public.post_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_comments.post_id
      AND public.can_view_social_post(auth.uid(), p)
  )
);

CREATE POLICY "Users can update their own comments"
ON public.post_comments FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.post_comments FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view likes" ON public.post_likes;
DROP POLICY IF EXISTS "Authenticated users can like posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can unlike their own likes" ON public.post_likes;

CREATE POLICY "Visible post likes are readable"
ON public.post_likes FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_likes.post_id
      AND public.can_view_social_post(auth.uid(), p)
  )
);

CREATE POLICY "Users can like visible posts"
ON public.post_likes FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_likes.post_id
      AND public.can_view_social_post(auth.uid(), p)
  )
);

CREATE POLICY "Users can unlike their own likes"
ON public.post_likes FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Visible post media is readable"
ON public.post_media FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_media.post_id
      AND public.can_view_social_post(auth.uid(), p)
  )
);

CREATE POLICY "Users can register their own post media"
ON public.post_media FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own post media"
ON public.post_media FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own share records"
ON public.post_shares FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own share records"
ON public.post_shares FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own blocks"
ON public.user_blocks FOR SELECT
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others"
ON public.user_blocks FOR INSERT
WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock others"
ON public.user_blocks FOR DELETE
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can view their post feed items"
ON public.post_feed_items FOR SELECT
USING (auth.uid() = viewer_id);

CREATE POLICY "Users can view their activity feed items"
ON public.activity_feed_items FOR SELECT
USING (auth.uid() = viewer_id);

INSERT INTO public.post_feed_items (viewer_id, post_id, actor_id, source, item_created_at)
SELECT p.user_id, p.id, p.user_id, 'self', p.created_at
FROM public.posts p
WHERE p.deleted_at IS NULL
  AND p.visibility <> 'private'
ON CONFLICT (viewer_id, post_id) DO NOTHING;

INSERT INTO public.post_feed_items (viewer_id, post_id, actor_id, source, item_created_at)
SELECT uf.follower_id, p.id, p.user_id, 'following', p.created_at
FROM public.posts p
JOIN public.user_follows uf
  ON uf.following_id = p.user_id
WHERE p.deleted_at IS NULL
  AND p.visibility <> 'private'
  AND NOT public.social_pair_blocked(uf.follower_id, p.user_id)
ON CONFLICT (viewer_id, post_id) DO NOTHING;

INSERT INTO public.activity_feed_items (viewer_id, activity_id, actor_id, item_created_at)
SELECT inbound.follower_id, sa.id, sa.user_id, sa.created_at
FROM public.social_activities sa
JOIN public.profiles actor
  ON actor.id = sa.user_id
JOIN public.user_follows inbound
  ON inbound.following_id = sa.user_id
JOIN public.user_follows outbound
  ON outbound.follower_id = sa.user_id
 AND outbound.following_id = inbound.follower_id
WHERE COALESCE(actor.show_reading_activity, true)
  AND inbound.follower_id <> sa.user_id
  AND NOT public.social_pair_blocked(inbound.follower_id, sa.user_id)
ON CONFLICT (viewer_id, activity_id) DO NOTHING;
