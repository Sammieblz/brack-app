-- Club group chat and rich text authoring support.

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'plain',
ADD COLUMN IF NOT EXISTS content_json JSONB NULL,
ADD COLUMN IF NOT EXISTS content_html TEXT NULL;

ALTER TABLE public.journal_entries
ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'plain',
ADD COLUMN IF NOT EXISTS content_json JSONB NULL,
ADD COLUMN IF NOT EXISTS content_html TEXT NULL;

ALTER TABLE public.book_reviews
ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'plain',
ADD COLUMN IF NOT EXISTS content_json JSONB NULL,
ADD COLUMN IF NOT EXISTS content_html TEXT NULL;

ALTER TABLE public.book_club_discussions
ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'plain',
ADD COLUMN IF NOT EXISTS content_json JSONB NULL,
ADD COLUMN IF NOT EXISTS content_html TEXT NULL;

ALTER TABLE public.posts
DROP CONSTRAINT IF EXISTS posts_content_format_check;
ALTER TABLE public.posts
ADD CONSTRAINT posts_content_format_check
CHECK (content_format IN ('plain', 'tiptap'));

ALTER TABLE public.journal_entries
DROP CONSTRAINT IF EXISTS journal_entries_content_format_check;
ALTER TABLE public.journal_entries
ADD CONSTRAINT journal_entries_content_format_check
CHECK (content_format IN ('plain', 'tiptap'));

ALTER TABLE public.book_reviews
DROP CONSTRAINT IF EXISTS book_reviews_content_format_check;
ALTER TABLE public.book_reviews
ADD CONSTRAINT book_reviews_content_format_check
CHECK (content_format IN ('plain', 'tiptap'));

ALTER TABLE public.book_club_discussions
DROP CONSTRAINT IF EXISTS book_club_discussions_content_format_check;
ALTER TABLE public.book_club_discussions
ADD CONSTRAINT book_club_discussions_content_format_check
CHECK (content_format IN ('plain', 'tiptap'));

ALTER TABLE public.posts
DROP CONSTRAINT IF EXISTS posts_content_json_object;
ALTER TABLE public.posts
ADD CONSTRAINT posts_content_json_object
CHECK (content_json IS NULL OR jsonb_typeof(content_json) = 'object');

ALTER TABLE public.journal_entries
DROP CONSTRAINT IF EXISTS journal_entries_content_json_object;
ALTER TABLE public.journal_entries
ADD CONSTRAINT journal_entries_content_json_object
CHECK (content_json IS NULL OR jsonb_typeof(content_json) = 'object');

ALTER TABLE public.book_reviews
DROP CONSTRAINT IF EXISTS book_reviews_content_json_object;
ALTER TABLE public.book_reviews
ADD CONSTRAINT book_reviews_content_json_object
CHECK (content_json IS NULL OR jsonb_typeof(content_json) = 'object');

ALTER TABLE public.book_club_discussions
DROP CONSTRAINT IF EXISTS book_club_discussions_content_json_object;
ALTER TABLE public.book_club_discussions
ADD CONSTRAINT book_club_discussions_content_json_object
CHECK (content_json IS NULL OR jsonb_typeof(content_json) = 'object');

CREATE TABLE IF NOT EXISTS public.club_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  reply_to_message_id UUID NULL REFERENCES public.club_chat_messages(id) ON DELETE SET NULL,
  client_message_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  edited_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT club_chat_messages_type_check CHECK (message_type IN ('text', 'media', 'gif')),
  CONSTRAINT club_chat_messages_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.club_chat_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.club_chat_messages(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_source TEXT NOT NULL DEFAULT 'upload',
  media_type TEXT NOT NULL,
  bucket_id TEXT NOT NULL DEFAULT 'club-media',
  storage_path TEXT NULL,
  external_url TEXT NULL,
  preview_url TEXT NULL,
  provider TEXT NULL,
  provider_id TEXT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NULL CHECK (size_bytes IS NULL OR size_bytes > 0),
  width INTEGER NULL,
  height INTEGER NULL,
  position INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT club_chat_media_source_check CHECK (media_source IN ('upload', 'tenor')),
  CONSTRAINT club_chat_media_type_check CHECK (media_type IN ('image', 'gif')),
  CONSTRAINT club_chat_media_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT club_chat_media_source_payload_check CHECK (
    (media_source = 'upload' AND storage_path IS NOT NULL AND external_url IS NULL)
    OR
    (media_source = 'tenor' AND external_url IS NOT NULL AND provider = 'tenor')
  )
);

CREATE TABLE IF NOT EXISTS public.club_chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.club_chat_messages(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT club_chat_reactions_type_check CHECK (reaction_type IN ('like', 'dislike', 'heart', 'laugh', 'wow', 'thanks')),
  UNIQUE (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.club_chat_reads (
  club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_message_id UUID NULL REFERENCES public.club_chat_messages(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.club_chat_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.club_chat_messages(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, mentioned_user_id)
);

CREATE TABLE IF NOT EXISTS public.club_chat_user_settings (
  club_id UUID NOT NULL REFERENCES public.book_clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  last_opened_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_chat_sender_client_message
ON public.club_chat_messages(user_id, client_message_id)
WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_chat_messages_club_created
ON public.club_chat_messages(club_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_club_chat_messages_reply_to
ON public.club_chat_messages(reply_to_message_id)
WHERE reply_to_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_chat_media_message_position
ON public.club_chat_media(message_id, position);

CREATE INDEX IF NOT EXISTS idx_club_chat_reactions_message
ON public.club_chat_reactions(message_id, reaction_type);

CREATE INDEX IF NOT EXISTS idx_club_chat_reads_user
ON public.club_chat_reads(user_id, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_club_chat_mentions_user
ON public.club_chat_mentions(mentioned_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_club_chat_settings_user
ON public.club_chat_user_settings(user_id, is_muted, updated_at DESC);

CREATE OR REPLACE FUNCTION public.club_chat_pair_blocked(
  p_user_a UUID,
  p_user_b UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_blocks ub
    WHERE (ub.blocker_id = p_user_a AND ub.blocked_id = p_user_b)
       OR (ub.blocker_id = p_user_b AND ub.blocked_id = p_user_a)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_club_chat_message(
  p_club_id UUID,
  p_author_id UUID,
  p_viewer_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.is_club_member(p_club_id, p_viewer_id)
    AND NOT public.club_chat_pair_blocked(p_author_id, p_viewer_id);
$$;

DROP TRIGGER IF EXISTS update_club_chat_messages_updated_at ON public.club_chat_messages;
CREATE TRIGGER update_club_chat_messages_updated_at
BEFORE UPDATE ON public.club_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_club_chat_reactions_updated_at ON public.club_chat_reactions;
CREATE TRIGGER update_club_chat_reactions_updated_at
BEFORE UPDATE ON public.club_chat_reactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_club_chat_reads_updated_at ON public.club_chat_reads;
CREATE TRIGGER update_club_chat_reads_updated_at
BEFORE UPDATE ON public.club_chat_reads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_club_chat_user_settings_updated_at ON public.club_chat_user_settings;
CREATE TRIGGER update_club_chat_user_settings_updated_at
BEFORE UPDATE ON public.club_chat_user_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.club_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_chat_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_chat_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_chat_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_chat_user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view visible chat messages" ON public.club_chat_messages;
CREATE POLICY "Club members can view visible chat messages"
ON public.club_chat_messages FOR SELECT
USING (public.can_view_club_chat_message(club_id, user_id, auth.uid()));

DROP POLICY IF EXISTS "Club members can create chat messages" ON public.club_chat_messages;
CREATE POLICY "Club members can create chat messages"
ON public.club_chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Authors and moderators can update chat messages" ON public.club_chat_messages;
CREATE POLICY "Authors and moderators can update chat messages"
ON public.club_chat_messages FOR UPDATE
USING (auth.uid() = user_id OR public.is_club_moderator_or_admin(club_id, auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_club_moderator_or_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club members can view visible chat media" ON public.club_chat_media;
CREATE POLICY "Club members can view visible chat media"
ON public.club_chat_media FOR SELECT
USING (
  public.is_club_member(club_id, auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.club_chat_messages m
    WHERE m.id = club_chat_media.message_id
      AND public.can_view_club_chat_message(m.club_id, m.user_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Club members can register own chat media" ON public.club_chat_media;
CREATE POLICY "Club members can register own chat media"
ON public.club_chat_media FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club members can view chat reactions" ON public.club_chat_reactions;
CREATE POLICY "Club members can view chat reactions"
ON public.club_chat_reactions FOR SELECT
USING (
  public.is_club_member(club_id, auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.club_chat_messages m
    WHERE m.id = club_chat_reactions.message_id
      AND public.can_view_club_chat_message(m.club_id, m.user_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Club members can create own chat reactions" ON public.club_chat_reactions;
CREATE POLICY "Club members can create own chat reactions"
ON public.club_chat_reactions FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update own chat reactions" ON public.club_chat_reactions;
CREATE POLICY "Users can update own chat reactions"
ON public.club_chat_reactions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat reactions" ON public.club_chat_reactions;
CREATE POLICY "Users can delete own chat reactions"
ON public.club_chat_reactions FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Club members can view own chat reads" ON public.club_chat_reads;
CREATE POLICY "Club members can view own chat reads"
ON public.club_chat_reads FOR SELECT
USING (auth.uid() = user_id AND public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club members can write own chat reads" ON public.club_chat_reads;
CREATE POLICY "Club members can write own chat reads"
ON public.club_chat_reads FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club members can update own chat reads" ON public.club_chat_reads;
CREATE POLICY "Club members can update own chat reads"
ON public.club_chat_reads FOR UPDATE
USING (auth.uid() = user_id AND public.is_club_member(club_id, auth.uid()))
WITH CHECK (auth.uid() = user_id AND public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club members can view chat mentions" ON public.club_chat_mentions;
CREATE POLICY "Club members can view chat mentions"
ON public.club_chat_mentions FOR SELECT
USING (public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club members can create chat mentions" ON public.club_chat_mentions;
CREATE POLICY "Club members can create chat mentions"
ON public.club_chat_mentions FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND public.is_club_member(club_id, auth.uid())
  AND public.is_club_member(club_id, mentioned_user_id)
);

DROP POLICY IF EXISTS "Club members can view own chat settings" ON public.club_chat_user_settings;
CREATE POLICY "Club members can view own chat settings"
ON public.club_chat_user_settings FOR SELECT
USING (auth.uid() = user_id AND public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club members can write own chat settings" ON public.club_chat_user_settings;
CREATE POLICY "Club members can write own chat settings"
ON public.club_chat_user_settings FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club members can update own chat settings" ON public.club_chat_user_settings;
CREATE POLICY "Club members can update own chat settings"
ON public.club_chat_user_settings FOR UPDATE
USING (auth.uid() = user_id AND public.is_club_member(club_id, auth.uid()))
WITH CHECK (auth.uid() = user_id AND public.is_club_member(club_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.club_chat_messages TO authenticated;
GRANT SELECT, INSERT ON public.club_chat_media TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_chat_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.club_chat_reads TO authenticated;
GRANT SELECT, INSERT ON public.club_chat_mentions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.club_chat_user_settings TO authenticated;
