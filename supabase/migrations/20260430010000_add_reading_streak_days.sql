-- Persist one streak activity row per user/day.
-- Timer sessions and manual progress logs are synced by triggers; freeze days are
-- written explicitly by the app so streak calculations do not depend on profile
-- fields alone.

CREATE TABLE public.reading_streak_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  session_count INTEGER NOT NULL DEFAULT 0 CHECK (session_count >= 0),
  progress_log_count INTEGER NOT NULL DEFAULT 0 CHECK (progress_log_count >= 0),
  total_minutes INTEGER NOT NULL DEFAULT 0 CHECK (total_minutes >= 0),
  used_freeze BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT reading_streak_days_user_date_key UNIQUE (user_id, activity_date),
  CONSTRAINT reading_streak_days_has_activity_check
    CHECK (used_freeze OR session_count > 0 OR progress_log_count > 0)
);

ALTER TABLE public.reading_streak_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own streak days"
ON public.reading_streak_days
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streak days"
ON public.reading_streak_days
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak days"
ON public.reading_streak_days
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own streak days"
ON public.reading_streak_days
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_reading_streak_days_user_date
ON public.reading_streak_days(user_id, activity_date DESC);

CREATE INDEX idx_reading_streak_days_user_freeze
ON public.reading_streak_days(user_id, used_freeze)
WHERE used_freeze = true;

CREATE OR REPLACE FUNCTION public.refresh_reading_streak_day(
  p_user_id UUID,
  p_activity_date DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_count INTEGER := 0;
  v_progress_log_count INTEGER := 0;
  v_total_session_minutes INTEGER := 0;
  v_total_progress_minutes INTEGER := 0;
  v_used_freeze BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL OR p_activity_date IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(GREATEST(COALESCE(duration, 0), 0)), 0)::INTEGER
  INTO v_session_count, v_total_session_minutes
  FROM public.reading_sessions
  WHERE user_id = p_user_id
    AND COALESCE(start_time, created_at)::DATE = p_activity_date;

  SELECT
    COUNT(*)::INTEGER,
    COALESCE(SUM(GREATEST(COALESCE(time_spent_minutes, 0), 0)), 0)::INTEGER
  INTO v_progress_log_count, v_total_progress_minutes
  FROM public.progress_logs
  WHERE user_id = p_user_id
    AND logged_at::DATE = p_activity_date;

  SELECT COALESCE(used_freeze, false)
  INTO v_used_freeze
  FROM public.reading_streak_days
  WHERE user_id = p_user_id
    AND activity_date = p_activity_date;

  v_used_freeze := COALESCE(v_used_freeze, false);

  IF v_session_count > 0 OR v_progress_log_count > 0 OR v_used_freeze THEN
    INSERT INTO public.reading_streak_days (
      user_id,
      activity_date,
      session_count,
      progress_log_count,
      total_minutes,
      used_freeze,
      updated_at
    )
    VALUES (
      p_user_id,
      p_activity_date,
      v_session_count,
      v_progress_log_count,
      v_total_session_minutes + v_total_progress_minutes,
      v_used_freeze,
      timezone('utc'::text, now())
    )
    ON CONFLICT (user_id, activity_date)
    DO UPDATE SET
      session_count = EXCLUDED.session_count,
      progress_log_count = EXCLUDED.progress_log_count,
      total_minutes = EXCLUDED.total_minutes,
      used_freeze = public.reading_streak_days.used_freeze OR EXCLUDED.used_freeze,
      updated_at = timezone('utc'::text, now());
  ELSE
    DELETE FROM public.reading_streak_days
    WHERE user_id = p_user_id
      AND activity_date = p_activity_date;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reading_streak_day_from_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_date DATE;
  v_new_date DATE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_date := COALESCE(NEW.start_time, NEW.created_at)::DATE;
    PERFORM public.refresh_reading_streak_day(NEW.user_id, v_new_date);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_date := COALESCE(OLD.start_time, OLD.created_at)::DATE;
    v_new_date := COALESCE(NEW.start_time, NEW.created_at)::DATE;

    PERFORM public.refresh_reading_streak_day(NEW.user_id, v_new_date);

    IF OLD.user_id IS DISTINCT FROM NEW.user_id OR v_old_date IS DISTINCT FROM v_new_date THEN
      PERFORM public.refresh_reading_streak_day(OLD.user_id, v_old_date);
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_date := COALESCE(OLD.start_time, OLD.created_at)::DATE;
    PERFORM public.refresh_reading_streak_day(OLD.user_id, v_old_date);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_reading_streak_day_from_progress_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_date DATE;
  v_new_date DATE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_date := NEW.logged_at::DATE;
    PERFORM public.refresh_reading_streak_day(NEW.user_id, v_new_date);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_date := OLD.logged_at::DATE;
    v_new_date := NEW.logged_at::DATE;

    PERFORM public.refresh_reading_streak_day(NEW.user_id, v_new_date);

    IF OLD.user_id IS DISTINCT FROM NEW.user_id OR v_old_date IS DISTINCT FROM v_new_date THEN
      PERFORM public.refresh_reading_streak_day(OLD.user_id, v_old_date);
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_old_date := OLD.logged_at::DATE;
    PERFORM public.refresh_reading_streak_day(OLD.user_id, v_old_date);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.use_reading_streak_freeze(
  p_user_id UUID,
  p_activity_date DATE DEFAULT CURRENT_DATE
)
RETURNS public.reading_streak_days
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day public.reading_streak_days;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to use a streak freeze for this user';
  END IF;

  INSERT INTO public.reading_streak_days (
    user_id,
    activity_date,
    used_freeze,
    updated_at
  )
  VALUES (
    p_user_id,
    p_activity_date,
    true,
    timezone('utc'::text, now())
  )
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET
    used_freeze = true,
    updated_at = timezone('utc'::text, now())
  WHERE public.reading_streak_days.session_count = 0
    AND public.reading_streak_days.progress_log_count = 0
  RETURNING * INTO v_day;

  IF v_day.id IS NULL THEN
    RAISE EXCEPTION 'Cannot use a streak freeze on a day that already has reading activity';
  END IF;

  UPDATE public.profiles
  SET
    streak_freeze_used_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  RETURN v_day;
END;
$$;

GRANT EXECUTE ON FUNCTION public.use_reading_streak_freeze(UUID, DATE) TO authenticated;

DROP TRIGGER IF EXISTS trg_sync_reading_streak_day_from_session
ON public.reading_sessions;

CREATE TRIGGER trg_sync_reading_streak_day_from_session
AFTER INSERT OR UPDATE OR DELETE ON public.reading_sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_reading_streak_day_from_session();

DROP TRIGGER IF EXISTS trg_sync_reading_streak_day_from_progress_log
ON public.progress_logs;

CREATE TRIGGER trg_sync_reading_streak_day_from_progress_log
AFTER INSERT OR UPDATE OR DELETE ON public.progress_logs
FOR EACH ROW
EXECUTE FUNCTION public.sync_reading_streak_day_from_progress_log();

WITH activity_dates AS (
  SELECT
    user_id,
    COALESCE(start_time, created_at)::DATE AS activity_date
  FROM public.reading_sessions
  WHERE user_id IS NOT NULL
    AND COALESCE(start_time, created_at) IS NOT NULL

  UNION

  SELECT
    user_id,
    logged_at::DATE AS activity_date
  FROM public.progress_logs
  WHERE user_id IS NOT NULL
    AND logged_at IS NOT NULL
)
SELECT public.refresh_reading_streak_day(user_id, activity_date)
FROM activity_dates;
