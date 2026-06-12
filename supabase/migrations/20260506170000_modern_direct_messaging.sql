-- Modern direct messaging: private media, reactions, read cursors, and per-user conversation settings.

ALTER TABLE public.messages
ALTER COLUMN content DROP NOT NULL;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
ADD COLUMN IF NOT EXISTS reply_to_message_id UUID NULL REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS client_message_id TEXT NULL,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.messages
DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE public.messages
ADD CONSTRAINT messages_message_type_check
CHECK (message_type IN ('text', 'media', 'gif'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_sender_client_message
ON public.messages(sender_id, client_message_id)
WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_active_created
ON public.messages(conversation_id, created_at ASC, id ASC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to
ON public.messages(reply_to_message_id)
WHERE reply_to_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.conversation_reads (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_message_id UUID NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.conversation_user_settings (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  hidden_at TIMESTAMPTZ NULL,
  last_opened_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.message_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_source TEXT NOT NULL DEFAULT 'upload' CHECK (media_source IN ('upload', 'tenor')),
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'gif')),
  bucket_id TEXT NOT NULL DEFAULT 'message-media',
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
  CHECK (
    (media_source = 'upload' AND storage_path IS NOT NULL AND external_url IS NULL)
    OR
    (media_source = 'tenor' AND external_url IS NOT NULL AND provider = 'tenor')
  )
);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike', 'heart', 'laugh', 'wow', 'thanks')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_reads_user
ON public.conversation_reads(user_id, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_user_settings_user
ON public.conversation_user_settings(user_id, is_archived, is_pinned, hidden_at);

CREATE INDEX IF NOT EXISTS idx_message_media_message_position
ON public.message_media(message_id, position);

CREATE INDEX IF NOT EXISTS idx_message_media_conversation
ON public.message_media(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message
ON public.message_reactions(message_id, reaction_type);

CREATE INDEX IF NOT EXISTS idx_message_reactions_user
ON public.message_reactions(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_conversation_participant(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND p_user_id IN (c.participant_one_id, c.participant_two_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.conversation_other_participant_id(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.participant_one_id = p_user_id THEN c.participant_two_id
    WHEN c.participant_two_id = p_user_id THEN c.participant_one_id
    ELSE NULL
  END
  FROM public.conversations c
  WHERE c.id = p_conversation_id;
$$;

CREATE OR REPLACE FUNCTION public.messaging_pair_blocked(
  p_user_a UUID,
  p_user_b UUID
)
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

CREATE TRIGGER update_conversation_reads_updated_at
  BEFORE UPDATE ON public.conversation_reads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversation_user_settings_updated_at
  BEFORE UPDATE ON public.conversation_user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_message_reactions_updated_at
  BEFORE UPDATE ON public.message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-media',
  'message-media',
  false,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "Users can upload own message media" ON storage.objects;
CREATE POLICY "Users can upload own message media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'message-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update own message media" ON storage.objects;
CREATE POLICY "Users can update own message media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'message-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'message-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete own message media" ON storage.objects;
CREATE POLICY "Users can delete own message media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'message-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their read cursors"
ON public.conversation_reads FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Participants can write their read cursor"
ON public.conversation_reads FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Participants can update their read cursor"
ON public.conversation_reads FOR UPDATE
USING (
  auth.uid() = user_id
  AND public.is_conversation_participant(conversation_id, auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Users can view own conversation settings"
ON public.conversation_user_settings FOR SELECT
USING (
  auth.uid() = user_id
  AND public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Users can create own conversation settings"
ON public.conversation_user_settings FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Users can update own conversation settings"
ON public.conversation_user_settings FOR UPDATE
USING (
  auth.uid() = user_id
  AND public.is_conversation_participant(conversation_id, auth.uid())
)
WITH CHECK (
  auth.uid() = user_id
  AND public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Participants can view message media"
ON public.message_media FOR SELECT
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
  AND NOT public.messaging_pair_blocked(
    auth.uid(),
    public.conversation_other_participant_id(conversation_id, auth.uid())
  )
);

CREATE POLICY "Participants can register own message media"
ON public.message_media FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.is_conversation_participant(conversation_id, auth.uid())
  AND NOT public.messaging_pair_blocked(
    auth.uid(),
    public.conversation_other_participant_id(conversation_id, auth.uid())
  )
);

CREATE POLICY "Participants can view message reactions"
ON public.message_reactions FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Participants can react to visible messages"
ON public.message_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.is_conversation_participant(conversation_id, auth.uid())
  AND NOT public.messaging_pair_blocked(
    auth.uid(),
    public.conversation_other_participant_id(conversation_id, auth.uid())
  )
);

CREATE POLICY "Users can update own message reaction"
ON public.message_reactions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own message reaction"
ON public.message_reactions FOR DELETE
USING (auth.uid() = user_id);
