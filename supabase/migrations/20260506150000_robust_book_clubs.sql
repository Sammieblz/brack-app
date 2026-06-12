-- Robust Book Clubs: discovery metadata, join requests, invites, counts, and discussion moderation.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE public.book_clubs
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS genres TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS member_limit INTEGER,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS member_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS discussion_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS announcement_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.book_clubs
DROP CONSTRAINT IF EXISTS book_clubs_member_limit_check;

ALTER TABLE public.book_clubs
ADD CONSTRAINT book_clubs_member_limit_check
CHECK (member_limit IS NULL OR member_limit BETWEEN 2 AND 10000);

ALTER TABLE public.book_club_discussions
ADD COLUMN IF NOT EXISTS discussion_type TEXT NOT NULL DEFAULT 'discussion',
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reply_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.book_club_discussions
DROP CONSTRAINT IF EXISTS book_club_discussions_type_check;

ALTER TABLE public.book_club_discussions
ADD CONSTRAINT book_club_discussions_type_check
CHECK (discussion_type IN ('discussion', 'announcement'));

CREATE TABLE IF NOT EXISTS public.book_club_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT book_club_join_requests_status_check
    CHECK (status IN ('pending', 'approved', 'declined', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.book_club_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  message TEXT,
  expires_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT book_club_invites_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_book_club_pending_join_request
ON public.book_club_join_requests(club_id, user_id)
WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_book_club_pending_invite
ON public.book_club_invites(club_id, invited_user_id)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_book_clubs_name_trgm
ON public.book_clubs USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_book_clubs_genres
ON public.book_clubs USING gin (genres);

CREATE INDEX IF NOT EXISTS idx_book_clubs_tags
ON public.book_clubs USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_book_clubs_location
ON public.book_clubs(is_private, country, city, latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_book_clubs_popularity
ON public.book_clubs(is_private, member_count DESC, last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_club_join_requests_club_status
ON public.book_club_join_requests(club_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_club_join_requests_user_status
ON public.book_club_join_requests(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_club_invites_user_status
ON public.book_club_invites(invited_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_club_invites_club_status
ON public.book_club_invites(club_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_club_discussions_club_type_pinned
ON public.book_club_discussions(club_id, discussion_type, is_pinned DESC, created_at DESC)
WHERE parent_id IS NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.is_club_moderator_or_admin(club_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.book_club_members
    WHERE book_club_members.club_id = is_club_moderator_or_admin.club_id
      AND book_club_members.user_id = is_club_moderator_or_admin.user_id
      AND book_club_members.role IN ('admin', 'moderator')
  );
$$;

CREATE OR REPLACE FUNCTION public.refresh_book_club_counts(p_club_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.book_clubs
  SET
    member_count = (
      SELECT COUNT(*)::INTEGER
      FROM public.book_club_members
      WHERE club_id = p_club_id
    ),
    discussion_count = (
      SELECT COUNT(*)::INTEGER
      FROM public.book_club_discussions
      WHERE club_id = p_club_id
        AND parent_id IS NULL
        AND discussion_type = 'discussion'
        AND deleted_at IS NULL
    ),
    announcement_count = (
      SELECT COUNT(*)::INTEGER
      FROM public.book_club_discussions
      WHERE club_id = p_club_id
        AND parent_id IS NULL
        AND discussion_type = 'announcement'
        AND deleted_at IS NULL
    )
  WHERE id = p_club_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_book_club_reply_count(p_parent_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_parent_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.book_club_discussions
  SET reply_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.book_club_discussions
    WHERE parent_id = p_parent_id
      AND deleted_at IS NULL
  )
  WHERE id = p_parent_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_book_club_member_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_book_club_counts(COALESCE(NEW.club_id, OLD.club_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_book_club_discussion_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id UUID;
BEGIN
  v_club_id := COALESCE(NEW.club_id, OLD.club_id);

  PERFORM public.refresh_book_club_counts(v_club_id);
  PERFORM public.refresh_book_club_reply_count(COALESCE(NEW.parent_id, OLD.parent_id));

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NULL) THEN
    UPDATE public.book_clubs
    SET last_activity_at = now()
    WHERE id = v_club_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS refresh_book_club_member_counts ON public.book_club_members;
CREATE TRIGGER refresh_book_club_member_counts
AFTER INSERT OR UPDATE OR DELETE ON public.book_club_members
FOR EACH ROW
EXECUTE FUNCTION public.handle_book_club_member_counts();

DROP TRIGGER IF EXISTS refresh_book_club_discussion_counts ON public.book_club_discussions;
CREATE TRIGGER refresh_book_club_discussion_counts
AFTER INSERT OR UPDATE OR DELETE ON public.book_club_discussions
FOR EACH ROW
EXECUTE FUNCTION public.handle_book_club_discussion_counts();

DROP TRIGGER IF EXISTS update_book_club_join_requests_updated_at ON public.book_club_join_requests;
CREATE TRIGGER update_book_club_join_requests_updated_at
BEFORE UPDATE ON public.book_club_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_book_club_invites_updated_at ON public.book_club_invites;
CREATE TRIGGER update_book_club_invites_updated_at
BEFORE UPDATE ON public.book_club_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.book_club_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Join requests visible to requester and club admins" ON public.book_club_join_requests;
CREATE POLICY "Join requests visible to requester and club admins"
ON public.book_club_join_requests FOR SELECT
USING (auth.uid() = user_id OR public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Users can request to join clubs" ON public.book_club_join_requests;
CREATE POLICY "Users can request to join clubs"
ON public.book_club_join_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Club admins can review join requests" ON public.book_club_join_requests;
CREATE POLICY "Club admins can review join requests"
ON public.book_club_join_requests FOR UPDATE
USING (public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Invites visible to invited users and club admins" ON public.book_club_invites;
CREATE POLICY "Invites visible to invited users and club admins"
ON public.book_club_invites FOR SELECT
USING (auth.uid() = invited_user_id OR public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club admins can invite members" ON public.book_club_invites;
CREATE POLICY "Club admins can invite members"
ON public.book_club_invites FOR INSERT
WITH CHECK (auth.uid() = invited_by AND public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Invited users and admins can update invites" ON public.book_club_invites;
CREATE POLICY "Invited users and admins can update invites"
ON public.book_club_invites FOR UPDATE
USING (auth.uid() = invited_user_id OR public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Moderators can update club discussions" ON public.book_club_discussions;
CREATE POLICY "Moderators can update club discussions"
ON public.book_club_discussions FOR UPDATE
USING (auth.uid() = user_id OR public.is_club_moderator_or_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Moderators can moderate club discussions" ON public.book_club_discussions;
CREATE POLICY "Moderators can moderate club discussions"
ON public.book_club_discussions FOR DELETE
USING (auth.uid() = user_id OR public.is_club_moderator_or_admin(club_id, auth.uid()));

UPDATE public.book_clubs club
SET
  member_count = COALESCE(member_counts.count, 0),
  discussion_count = COALESCE(discussion_counts.count, 0),
  announcement_count = COALESCE(announcement_counts.count, 0),
  last_activity_at = GREATEST(
    club.updated_at,
    COALESCE(activity.last_activity_at, club.updated_at)
  )
FROM (
  SELECT id FROM public.book_clubs
) clubs
LEFT JOIN (
  SELECT club_id, COUNT(*)::INTEGER AS count
  FROM public.book_club_members
  GROUP BY club_id
) member_counts ON member_counts.club_id = clubs.id
LEFT JOIN (
  SELECT club_id, COUNT(*)::INTEGER AS count
  FROM public.book_club_discussions
  WHERE parent_id IS NULL AND discussion_type = 'discussion' AND deleted_at IS NULL
  GROUP BY club_id
) discussion_counts ON discussion_counts.club_id = clubs.id
LEFT JOIN (
  SELECT club_id, COUNT(*)::INTEGER AS count
  FROM public.book_club_discussions
  WHERE parent_id IS NULL AND discussion_type = 'announcement' AND deleted_at IS NULL
  GROUP BY club_id
) announcement_counts ON announcement_counts.club_id = clubs.id
LEFT JOIN (
  SELECT club_id, MAX(created_at) AS last_activity_at
  FROM public.book_club_discussions
  WHERE deleted_at IS NULL
  GROUP BY club_id
) activity ON activity.club_id = clubs.id
WHERE club.id = clubs.id;
