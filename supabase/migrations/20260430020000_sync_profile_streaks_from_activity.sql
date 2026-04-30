-- Keep persisted profile streak fields in sync whenever daily reading activity changes.
-- reading_streak_days is already refreshed from timer sessions and progress logs;
-- this layer makes session completion update profiles.current_streak immediately.

CREATE OR REPLACE FUNCTION public.recalculate_user_reading_streak(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - 1;
  v_check_date DATE;
  v_activity_date DATE;
  v_previous_date DATE;
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_temp_streak INTEGER := 0;
  v_profile_longest_streak INTEGER := 0;
  v_last_reading_date DATE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'current_streak', 0,
      'longest_streak', 0,
      'last_reading_date', NULL
    );
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to recalculate streaks for this user';
  END IF;

  SELECT COALESCE(longest_streak, 0)
  INTO v_profile_longest_streak
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'current_streak', 0,
      'longest_streak', 0,
      'last_reading_date', NULL
    );
  END IF;

  SELECT MAX(activity_date)
  INTO v_last_reading_date
  FROM public.reading_streak_days
  WHERE user_id = p_user_id
    AND (session_count > 0 OR progress_log_count > 0);

  IF EXISTS (
    SELECT 1
    FROM public.reading_streak_days
    WHERE user_id = p_user_id
      AND activity_date = v_today
      AND (used_freeze OR session_count > 0 OR progress_log_count > 0)
  ) THEN
    v_check_date := v_today;
  ELSIF EXISTS (
    SELECT 1
    FROM public.reading_streak_days
    WHERE user_id = p_user_id
      AND activity_date = v_yesterday
      AND (used_freeze OR session_count > 0 OR progress_log_count > 0)
  ) THEN
    v_check_date := v_yesterday;
  ELSE
    v_check_date := NULL;
  END IF;

  WHILE v_check_date IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.reading_streak_days
    WHERE user_id = p_user_id
      AND activity_date = v_check_date
      AND (used_freeze OR session_count > 0 OR progress_log_count > 0)
  ) LOOP
    v_current_streak := v_current_streak + 1;
    v_check_date := v_check_date - 1;
  END LOOP;

  FOR v_activity_date IN
    SELECT activity_date
    FROM public.reading_streak_days
    WHERE user_id = p_user_id
      AND (used_freeze OR session_count > 0 OR progress_log_count > 0)
    ORDER BY activity_date ASC
  LOOP
    IF v_previous_date IS NULL OR v_activity_date = v_previous_date + 1 THEN
      v_temp_streak := v_temp_streak + 1;
    ELSE
      v_temp_streak := 1;
    END IF;

    v_longest_streak := GREATEST(v_longest_streak, v_temp_streak);
    v_previous_date := v_activity_date;
  END LOOP;

  v_longest_streak := GREATEST(v_longest_streak, v_profile_longest_streak);

  UPDATE public.profiles
  SET
    current_streak = v_current_streak,
    longest_streak = v_longest_streak,
    last_reading_date = v_last_reading_date,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  IF v_current_streak > v_profile_longest_streak
    AND NOT EXISTS (
      SELECT 1
      FROM public.reading_streak_history
      WHERE user_id = p_user_id
        AND streak_count = v_current_streak
    )
  THEN
    INSERT INTO public.reading_streak_history (
      user_id,
      streak_count,
      achieved_at
    )
    VALUES (
      p_user_id,
      v_current_streak,
      timezone('utc'::text, now())
    );
  END IF;

  RETURN jsonb_build_object(
    'current_streak', v_current_streak,
    'longest_streak', v_longest_streak,
    'last_reading_date', v_last_reading_date
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_streak_from_reading_streak_day()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_user_reading_streak(NEW.user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalculate_user_reading_streak(NEW.user_id);

    IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      PERFORM public.recalculate_user_reading_streak(OLD.user_id);
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_user_reading_streak(OLD.user_id);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_streak_from_reading_streak_day
ON public.reading_streak_days;

CREATE TRIGGER trg_sync_profile_streak_from_reading_streak_day
AFTER INSERT OR UPDATE OR DELETE ON public.reading_streak_days
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_streak_from_reading_streak_day();

GRANT EXECUTE ON FUNCTION public.recalculate_user_reading_streak(UUID) TO authenticated;

SELECT public.recalculate_user_reading_streak(user_id)
FROM (
  SELECT DISTINCT user_id
  FROM public.reading_streak_days
  WHERE user_id IS NOT NULL
) streak_users;
