-- Snapshot-backed dashboard home read model.
-- Keeps the existing dashboard-home response shape while avoiding repeated live
-- aggregation on every request when a fresh snapshot is available.

CREATE TABLE IF NOT EXISTS public.dashboard_home_snapshots (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  recent_limit INTEGER NOT NULL DEFAULT 10,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.dashboard_home_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own dashboard home snapshots"
ON public.dashboard_home_snapshots;

CREATE POLICY "Users can view their own dashboard home snapshots"
ON public.dashboard_home_snapshots
FOR SELECT
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_dashboard_home_snapshots_updated_at
ON public.dashboard_home_snapshots;

CREATE TRIGGER update_dashboard_home_snapshots_updated_at
BEFORE UPDATE ON public.dashboard_home_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.refresh_dashboard_home_snapshot(
  p_user_id UUID,
  p_recent_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_limit INTEGER := LEAST(GREATEST(COALESCE(p_recent_limit, 10), 1), 30);
  v_data JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to refresh dashboard home for this user';
  END IF;

  v_data := public.get_user_dashboard_stats(p_user_id, v_recent_limit);

  INSERT INTO public.dashboard_home_snapshots (
    user_id,
    data,
    recent_limit,
    generated_at,
    updated_at
  )
  VALUES (
    p_user_id,
    v_data,
    v_recent_limit,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    data = EXCLUDED.data,
    recent_limit = EXCLUDED.recent_limit,
    generated_at = EXCLUDED.generated_at,
    updated_at = EXCLUDED.updated_at;

  RETURN v_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_home_snapshot(
  p_user_id UUID,
  p_recent_limit INTEGER DEFAULT 10,
  p_max_age_seconds INTEGER DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_limit INTEGER := LEAST(GREATEST(COALESCE(p_recent_limit, 10), 1), 30);
  v_max_age_seconds INTEGER := LEAST(GREATEST(COALESCE(p_max_age_seconds, 300), 0), 86400);
  v_snapshot public.dashboard_home_snapshots;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to load dashboard home for this user';
  END IF;

  SELECT *
  INTO v_snapshot
  FROM public.dashboard_home_snapshots
  WHERE user_id = p_user_id
    AND recent_limit = v_recent_limit
    AND generated_at >= timezone('utc'::text, now()) - make_interval(secs => v_max_age_seconds);

  IF FOUND THEN
    RETURN v_snapshot.data;
  END IF;

  RETURN public.refresh_dashboard_home_snapshot(p_user_id, v_recent_limit);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_dashboard_home_snapshot(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_dashboard_home_snapshot(UUID, INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.refresh_dashboard_home_snapshot(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dashboard_home_snapshot(UUID, INTEGER, INTEGER) TO authenticated, service_role;

