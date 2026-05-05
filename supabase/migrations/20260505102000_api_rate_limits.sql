-- Distributed Edge Function rate limiting.
--
-- Edge instances can scale horizontally, so in-memory buckets only protect a
-- single runtime. This table and RPC provide a shared limiter keyed by
-- function/user/IP bucket.

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT timezone('utc', now()),
  window_seconds integer NOT NULL CHECK (window_seconds > 0),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.api_rate_limits IS
  'Shared rate limit buckets for Supabase Edge Functions. Written only through check_api_rate_limit.';

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.api_rate_limits FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_rate_limits TO service_role;

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_updated_at
ON public.api_rate_limits(updated_at);

CREATE OR REPLACE FUNCTION public.check_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_bucket public.api_rate_limits%ROWTYPE;
  v_reset_at timestamptz;
  v_retry_after integer;
BEGIN
  IF p_bucket_key IS NULL OR length(trim(p_bucket_key)) = 0 THEN
    RAISE EXCEPTION 'p_bucket_key is required';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'p_limit must be at least 1';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'p_window_seconds must be at least 1';
  END IF;

  -- Serialize updates per bucket so concurrent requests cannot overrun the
  -- configured limit between SELECT and UPDATE.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_bucket_key, 0));

  SELECT *
  INTO v_bucket
  FROM public.api_rate_limits
  WHERE bucket_key = p_bucket_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.api_rate_limits (
      bucket_key,
      window_start,
      window_seconds,
      request_count,
      updated_at
    )
    VALUES (
      p_bucket_key,
      v_now,
      p_window_seconds,
      1,
      v_now
    )
    RETURNING * INTO v_bucket;
  ELSIF v_bucket.window_start + make_interval(secs => v_bucket.window_seconds) <= v_now
    OR v_bucket.window_seconds <> p_window_seconds THEN
    UPDATE public.api_rate_limits
    SET
      window_start = v_now,
      window_seconds = p_window_seconds,
      request_count = 1,
      updated_at = v_now
    WHERE bucket_key = p_bucket_key
    RETURNING * INTO v_bucket;
  ELSIF v_bucket.request_count >= p_limit THEN
    v_reset_at := v_bucket.window_start + make_interval(secs => v_bucket.window_seconds);
    v_retry_after := greatest(1, ceiling(extract(epoch FROM (v_reset_at - v_now)))::integer);

    RETURN jsonb_build_object(
      'allowed', false,
      'limit', p_limit,
      'remaining', 0,
      'reset_at', v_reset_at,
      'retry_after_seconds', v_retry_after
    );
  ELSE
    UPDATE public.api_rate_limits
    SET
      request_count = request_count + 1,
      updated_at = v_now
    WHERE bucket_key = p_bucket_key
    RETURNING * INTO v_bucket;
  END IF;

  v_reset_at := v_bucket.window_start + make_interval(secs => v_bucket.window_seconds);

  -- Opportunistic cleanup keeps bucket rows bounded without requiring a cron.
  IF random() < 0.01 THEN
    DELETE FROM public.api_rate_limits
    WHERE updated_at < v_now - interval '24 hours'
      AND bucket_key <> p_bucket_key;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - v_bucket.request_count),
    'reset_at', v_reset_at,
    'retry_after_seconds', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_api_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_api_rate_limit(text, integer, integer) TO service_role;
