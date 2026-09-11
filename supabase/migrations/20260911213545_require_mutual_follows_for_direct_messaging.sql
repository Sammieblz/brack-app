-- Require an available, mutual-follow relationship for direct-message creation
-- and sending. Existing conversations remain readable when eligibility changes.

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS eligibility_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.lock_direct_message_user(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('brack-direct-message-user:' || p_user_id::TEXT, 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.lock_direct_message_pair(
  p_user_a UUID,
  p_user_b UUID
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_first UUID;
  v_second UUID;
BEGIN
  v_first := LEAST(p_user_a, p_user_b);
  v_second := GREATEST(p_user_a, p_user_b);

  PERFORM public.lock_direct_message_user(v_first);
  IF v_second IS DISTINCT FROM v_first THEN
    PERFORM public.lock_direct_message_user(v_second);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.direct_message_pair_status(
  p_user_a UUID,
  p_user_b UUID
)
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_user_a IS NULL OR p_user_b IS NULL OR p_user_a = p_user_b
      THEN 'restricted'
    WHEN (
      SELECT COUNT(*)
      FROM public.profiles AS profile
      WHERE profile.id IN (p_user_a, p_user_b)
        AND COALESCE(profile.profile_visibility, 'public') <> 'private'
    ) <> 2
      THEN 'restricted'
    WHEN EXISTS (
      SELECT 1
      FROM public.user_blocks AS block
      WHERE (block.blocker_id = p_user_a AND block.blocked_id = p_user_b)
         OR (block.blocker_id = p_user_b AND block.blocked_id = p_user_a)
    )
      THEN 'restricted'
    WHEN EXISTS (
      SELECT 1
      FROM public.user_follows AS outbound
      WHERE outbound.follower_id = p_user_a
        AND outbound.following_id = p_user_b
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_follows AS inbound
      WHERE inbound.follower_id = p_user_b
        AND inbound.following_id = p_user_a
    )
      THEN 'eligible'
    ELSE 'relationship_required'
  END;
$$;

CREATE OR REPLACE FUNCTION public.direct_message_conversation_status(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN conversation.id IS NULL THEN 'restricted'
    WHEN p_user_id = conversation.participant_one_id THEN
      public.direct_message_pair_status(
        conversation.participant_one_id,
        conversation.participant_two_id
      )
    WHEN p_user_id = conversation.participant_two_id THEN
      public.direct_message_pair_status(
        conversation.participant_one_id,
        conversation.participant_two_id
      )
    ELSE 'restricted'
  END
  FROM (SELECT 1) AS seed
  LEFT JOIN public.conversations AS conversation
    ON conversation.id = p_conversation_id;
$$;

CREATE OR REPLACE FUNCTION public.current_user_direct_message_pair_status(
  p_other_user_id UUID
)
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN 'restricted'
    ELSE public.direct_message_pair_status(
      (SELECT auth.uid()),
      p_other_user_id
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_direct_message_conversation_status(
  p_conversation_id UUID
)
RETURNS TEXT
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN 'restricted'
    ELSE public.direct_message_conversation_status(
      p_conversation_id,
      (SELECT auth.uid())
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.lock_direct_message_user(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_direct_message_pair(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.direct_message_pair_status(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.direct_message_conversation_status(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_user_direct_message_pair_status(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_direct_message_conversation_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direct_message_pair_status(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.direct_message_conversation_status(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_direct_message_pair_status(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_direct_message_conversation_status(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lock_direct_message_relationship_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.lock_direct_message_pair(OLD.follower_id, OLD.following_id);
    RETURN OLD;
  END IF;

  PERFORM public.lock_direct_message_pair(NEW.follower_id, NEW.following_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_direct_message_block_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.lock_direct_message_pair(OLD.blocker_id, OLD.blocked_id);
    RETURN OLD;
  END IF;

  PERFORM public.lock_direct_message_pair(NEW.blocker_id, NEW.blocked_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_direct_message_profile_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.lock_direct_message_user(OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.lock_direct_message_user(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_direct_conversation_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.lock_direct_message_pair(
    NEW.participant_one_id,
    NEW.participant_two_id
  );

  IF public.direct_message_pair_status(
    NEW.participant_one_id,
    NEW.participant_two_id
  ) <> 'eligible' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Direct messaging is unavailable for this reader.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_direct_message_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_participant_one_id UUID;
  v_participant_two_id UUID;
BEGIN
  SELECT
    conversation.participant_one_id,
    conversation.participant_two_id
  INTO v_participant_one_id, v_participant_two_id
  FROM public.conversations AS conversation
  WHERE conversation.id = NEW.conversation_id;

  IF NOT FOUND OR NEW.sender_id NOT IN (v_participant_one_id, v_participant_two_id) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Direct messaging is unavailable for this reader.';
  END IF;

  PERFORM public.lock_direct_message_pair(
    v_participant_one_id,
    v_participant_two_id
  );

  SELECT
    conversation.participant_one_id,
    conversation.participant_two_id
  INTO v_participant_one_id, v_participant_two_id
  FROM public.conversations AS conversation
  WHERE conversation.id = NEW.conversation_id
  FOR KEY SHARE;

  IF NOT FOUND OR NEW.sender_id NOT IN (v_participant_one_id, v_participant_two_id) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Direct messaging is unavailable for this reader.';
  END IF;

  IF public.direct_message_pair_status(
    v_participant_one_id,
    v_participant_two_id
  ) <> 'eligible' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Direct messaging is unavailable for this reader.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_direct_message_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_a UUID;
  v_user_b UUID;
BEGIN
  IF TG_TABLE_NAME = 'user_follows' THEN
    IF TG_OP = 'DELETE' THEN
      v_user_a := OLD.follower_id;
      v_user_b := OLD.following_id;
    ELSE
      v_user_a := NEW.follower_id;
      v_user_b := NEW.following_id;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      v_user_a := OLD.blocker_id;
      v_user_b := OLD.blocked_id;
    ELSE
      v_user_a := NEW.blocker_id;
      v_user_b := NEW.blocked_id;
    END IF;
  END IF;

  UPDATE public.conversations AS conversation
  SET eligibility_updated_at = clock_timestamp()
  WHERE (conversation.participant_one_id = v_user_a
     AND conversation.participant_two_id = v_user_b)
     OR (conversation.participant_one_id = v_user_b
     AND conversation.participant_two_id = v_user_a);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_direct_message_profile_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.profile_visibility IS DISTINCT FROM NEW.profile_visibility THEN
    UPDATE public.conversations AS conversation
    SET eligibility_updated_at = clock_timestamp()
    WHERE NEW.id IN (
      conversation.participant_one_id,
      conversation.participant_two_id
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_direct_message_relationship_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_direct_message_block_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_direct_message_profile_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_direct_conversation_eligibility() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_direct_message_eligibility() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_direct_message_eligibility() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_direct_message_profile_eligibility() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lock_direct_message_follows_trigger ON public.user_follows;
CREATE TRIGGER lock_direct_message_follows_trigger
BEFORE INSERT OR DELETE ON public.user_follows
FOR EACH ROW
EXECUTE FUNCTION public.lock_direct_message_relationship_change();

DROP TRIGGER IF EXISTS touch_direct_message_follows_trigger ON public.user_follows;
CREATE TRIGGER touch_direct_message_follows_trigger
AFTER INSERT OR DELETE ON public.user_follows
FOR EACH ROW
EXECUTE FUNCTION public.touch_direct_message_eligibility();

DROP TRIGGER IF EXISTS lock_direct_message_blocks_trigger ON public.user_blocks;
CREATE TRIGGER lock_direct_message_blocks_trigger
BEFORE INSERT OR DELETE ON public.user_blocks
FOR EACH ROW
EXECUTE FUNCTION public.lock_direct_message_block_change();

DROP TRIGGER IF EXISTS touch_direct_message_blocks_trigger ON public.user_blocks;
CREATE TRIGGER touch_direct_message_blocks_trigger
AFTER INSERT OR DELETE ON public.user_blocks
FOR EACH ROW
EXECUTE FUNCTION public.touch_direct_message_eligibility();

DROP TRIGGER IF EXISTS lock_direct_message_profile_visibility_trigger ON public.profiles;
CREATE TRIGGER lock_direct_message_profile_visibility_trigger
BEFORE UPDATE OF profile_visibility ON public.profiles
FOR EACH ROW
WHEN (OLD.profile_visibility IS DISTINCT FROM NEW.profile_visibility)
EXECUTE FUNCTION public.lock_direct_message_profile_change();

DROP TRIGGER IF EXISTS lock_direct_message_profile_delete_trigger ON public.profiles;
CREATE TRIGGER lock_direct_message_profile_delete_trigger
BEFORE DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.lock_direct_message_profile_change();

DROP TRIGGER IF EXISTS touch_direct_message_profile_visibility_trigger ON public.profiles;
CREATE TRIGGER touch_direct_message_profile_visibility_trigger
AFTER UPDATE OF profile_visibility ON public.profiles
FOR EACH ROW
WHEN (OLD.profile_visibility IS DISTINCT FROM NEW.profile_visibility)
EXECUTE FUNCTION public.touch_direct_message_profile_eligibility();

DROP TRIGGER IF EXISTS enforce_direct_conversation_eligibility_trigger ON public.conversations;
CREATE TRIGGER enforce_direct_conversation_eligibility_trigger
BEFORE INSERT ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_direct_conversation_eligibility();

DROP TRIGGER IF EXISTS enforce_direct_message_eligibility_trigger ON public.messages;
CREATE TRIGGER enforce_direct_message_eligibility_trigger
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_direct_message_eligibility();

-- Eligibility-only updates must not reorder the inbox. Message inserts already
-- set conversations.updated_at explicitly through update_conversation_timestamp.
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Mutual followers can create direct conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) IN (participant_one_id, participant_two_id)
  AND public.current_user_direct_message_pair_status(
    CASE
      WHEN (SELECT auth.uid()) = participant_one_id THEN participant_two_id
      ELSE participant_one_id
    END
  ) = 'eligible'
);

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
CREATE POLICY "Eligible participants can send direct messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = sender_id
  AND public.current_user_direct_message_conversation_status(conversation_id) = 'eligible'
);

DROP POLICY IF EXISTS "Participants can register own message media" ON public.message_media;
CREATE POLICY "Eligible participants can register own message media"
ON public.message_media FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND public.current_user_direct_message_conversation_status(conversation_id) = 'eligible'
);

DROP POLICY IF EXISTS "Participants can react to visible messages" ON public.message_reactions;
CREATE POLICY "Eligible participants can react to direct messages"
ON public.message_reactions FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND public.current_user_direct_message_conversation_status(conversation_id) = 'eligible'
);

DROP POLICY IF EXISTS "Users can update own message reaction" ON public.message_reactions;
CREATE POLICY "Eligible users can update own message reaction"
ON public.message_reactions FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND public.current_user_direct_message_conversation_status(conversation_id) = 'eligible'
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND public.current_user_direct_message_conversation_status(conversation_id) = 'eligible'
);

-- Follow changes must refresh relationship actions even before a conversation
-- exists. Conversation eligibility changes use the already-published
-- conversations table through eligibility_updated_at.
ALTER TABLE public.user_follows REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_follows'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_follows;
  END IF;
END;
$$;
