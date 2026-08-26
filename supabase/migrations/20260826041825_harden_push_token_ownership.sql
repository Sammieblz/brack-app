-- A native installation token belongs to one reader at a time. Older schema
-- versions allowed the same token to remain attached to multiple accounts,
-- which could route a notification to the wrong signed-in reader after an
-- account switch.

WITH ranked_tokens AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY token
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS ownership_rank
  FROM public.push_tokens
)
DELETE FROM public.push_tokens AS push_token
USING ranked_tokens
WHERE push_token.id = ranked_tokens.id
  AND ranked_tokens.ownership_rank > 1;

ALTER TABLE public.push_tokens
  DROP CONSTRAINT IF EXISTS push_tokens_user_id_token_key;

DROP INDEX IF EXISTS public.idx_push_tokens_token;

ALTER TABLE public.push_tokens
  ADD CONSTRAINT push_tokens_token_key UNIQUE (token);

DROP POLICY IF EXISTS "Users can update their own push tokens"
  ON public.push_tokens;

CREATE POLICY "Users can update their own push tokens"
  ON public.push_tokens
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.claim_push_token(
  p_token TEXT,
  p_platform TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_token TEXT := BTRIM(p_token);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to claim a push token.'
      USING ERRCODE = '42501';
  END IF;

  IF v_token = '' OR CHAR_LENGTH(v_token) > 4096 THEN
    RAISE EXCEPTION 'Push token is invalid.'
      USING ERRCODE = '22023';
  END IF;

  IF p_platform NOT IN ('ios', 'android', 'web') THEN
    RAISE EXCEPTION 'Push platform is invalid.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.push_tokens (
    user_id,
    token,
    platform
  )
  VALUES (
    v_user_id,
    v_token,
    p_platform
  )
  ON CONFLICT (token)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_token(TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_push_token(TEXT, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.claim_push_token(TEXT, TEXT) IS
  'Atomically assigns one installation push token to the verified current user.';
