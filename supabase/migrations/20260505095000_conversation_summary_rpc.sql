-- Conversation list summary read model.
-- Fetches conversation rows, the other participant profile, latest message,
-- and unread count in one backend query.

CREATE OR REPLACE FUNCTION public.get_conversation_summaries(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to load conversations for this user';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', conversations.id,
        'participant_one_id', conversations.participant_one_id,
        'participant_two_id', conversations.participant_two_id,
        'created_at', conversations.created_at,
        'updated_at', conversations.updated_at,
        'other_user', CASE
          WHEN profiles.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', profiles.id,
            'display_name', profiles.display_name,
            'avatar_url', profiles.avatar_url
          )
        END,
        'last_message', CASE
          WHEN latest_message.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'content', latest_message.content,
            'created_at', latest_message.created_at,
            'sender_id', latest_message.sender_id
          )
        END,
        'unread_count', COALESCE(unread_counts.unread_count, 0)
      )
      ORDER BY conversations.updated_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.conversations
  LEFT JOIN public.profiles
    ON profiles.id = CASE
      WHEN conversations.participant_one_id = p_user_id
        THEN conversations.participant_two_id
      ELSE conversations.participant_one_id
    END
  LEFT JOIN LATERAL (
    SELECT id, content, created_at, sender_id
    FROM public.messages
    WHERE messages.conversation_id = conversations.id
    ORDER BY messages.created_at DESC
    LIMIT 1
  ) latest_message ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::INTEGER AS unread_count
    FROM public.messages
    WHERE messages.conversation_id = conversations.id
      AND messages.is_read = false
      AND messages.sender_id <> p_user_id
  ) unread_counts ON true
  WHERE conversations.participant_one_id = p_user_id
     OR conversations.participant_two_id = p_user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_conversation_summaries(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_conversation_summaries(UUID) TO authenticated, service_role;

