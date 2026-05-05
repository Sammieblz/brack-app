-- Consolidate reading completion side effects behind one transaction boundary.
-- Timer sessions, manual progress logs, and explicit completion now share this
-- backend path for book status, streak refresh, goal completion, badges, and
-- social activity generation.

CREATE OR REPLACE FUNCTION public.complete_reading_transaction(
  p_user_id UUID,
  p_book_id UUID,
  p_start_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL,
  p_client_session_id TEXT DEFAULT NULL,
  p_page_number INTEGER DEFAULT NULL,
  p_chapter_number INTEGER DEFAULT NULL,
  p_paragraph_number INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_log_type TEXT DEFAULT 'manual',
  p_time_spent_minutes INTEGER DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_client_log_id TEXT DEFAULT NULL,
  p_mark_complete BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book_before public.books;
  v_book_after public.books;
  v_session public.reading_sessions;
  v_progress_log public.progress_logs;
  v_has_session_input BOOLEAN := p_start_time IS NOT NULL
    OR p_end_time IS NOT NULL
    OR p_duration_minutes IS NOT NULL;
  v_inserted_session BOOLEAN := false;
  v_inserted_progress BOOLEAN := false;
  v_session_idempotent BOOLEAN := false;
  v_progress_idempotent BOOLEAN := false;
  v_should_complete BOOLEAN := COALESCE(p_mark_complete, false);
  v_activity_date DATE := CURRENT_DATE;
  v_total_time_from_logs INTEGER := 0;
  v_total_time_from_sessions INTEGER := 0;
  v_total_time_minutes INTEGER := 0;
  v_total_hours NUMERIC := 0;
  v_progress_percentage NUMERIC := 0;
  v_pages_per_hour NUMERIC := 0;
  v_progress JSONB := '{}'::jsonb;
  v_streak JSONB := '{}'::jsonb;
  v_awards JSONB := '{}'::jsonb;
  v_goal_results JSONB := '[]'::jsonb;
  v_activity JSONB := NULL;
  v_goal public.goals;
  v_goal_current INTEGER := 0;
  v_goal_target INTEGER := 0;
  v_goal_progress NUMERIC := 0;
  v_goal_completed BOOLEAN := false;
  v_goal_result JSONB;
BEGIN
  IF p_user_id IS NULL OR p_book_id IS NULL THEN
    RAISE EXCEPTION 'User and book are required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to write reading activity for this user';
  END IF;

  SELECT *
  INTO v_book_before
  FROM public.books
  WHERE id = p_book_id
    AND user_id = p_user_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found or access denied';
  END IF;

  v_activity_date := COALESCE(p_start_time::DATE, CURRENT_DATE);

  IF v_has_session_input THEN
    IF p_start_time IS NULL
      OR p_end_time IS NULL
      OR p_duration_minutes IS NULL
      OR p_duration_minutes < 1
      OR p_end_time < p_start_time THEN
      RAISE EXCEPTION 'Invalid session time range or duration';
    END IF;

    v_activity_date := p_start_time::DATE;

    IF p_client_session_id IS NOT NULL AND trim(p_client_session_id) <> '' THEN
      SELECT *
      INTO v_session
      FROM public.reading_sessions
      WHERE user_id = p_user_id
        AND client_session_id = trim(p_client_session_id);

      v_session_idempotent := v_session.id IS NOT NULL;
    END IF;

    IF v_session.id IS NULL THEN
      INSERT INTO public.reading_sessions (
        user_id,
        book_id,
        start_time,
        end_time,
        duration,
        client_session_id
      )
      VALUES (
        p_user_id,
        p_book_id,
        p_start_time,
        p_end_time,
        p_duration_minutes,
        NULLIF(trim(COALESCE(p_client_session_id, '')), '')
      )
      ON CONFLICT (user_id, client_session_id) WHERE client_session_id IS NOT NULL
      DO NOTHING
      RETURNING * INTO v_session;

      IF v_session.id IS NULL AND p_client_session_id IS NOT NULL THEN
        SELECT *
        INTO v_session
        FROM public.reading_sessions
        WHERE user_id = p_user_id
          AND client_session_id = trim(p_client_session_id);

        v_session_idempotent := v_session.id IS NOT NULL;
      ELSE
        v_inserted_session := v_session.id IS NOT NULL;
      END IF;
    END IF;
  END IF;

  IF p_page_number IS NOT NULL THEN
    IF p_page_number < 1 THEN
      RAISE EXCEPTION 'Page number must be at least one';
    END IF;

    IF p_client_log_id IS NOT NULL AND trim(p_client_log_id) <> '' THEN
      SELECT *
      INTO v_progress_log
      FROM public.progress_logs
      WHERE user_id = p_user_id
        AND client_log_id = trim(p_client_log_id);

      v_progress_idempotent := v_progress_log.id IS NOT NULL;
    END IF;

    IF v_progress_log.id IS NULL THEN
      INSERT INTO public.progress_logs (
        user_id,
        book_id,
        page_number,
        chapter_number,
        paragraph_number,
        notes,
        log_type,
        time_spent_minutes,
        photo_url,
        client_log_id
      )
      VALUES (
        p_user_id,
        p_book_id,
        p_page_number,
        p_chapter_number,
        p_paragraph_number,
        p_notes,
        COALESCE(NULLIF(trim(COALESCE(p_log_type, '')), ''), 'manual'),
        p_time_spent_minutes,
        p_photo_url,
        NULLIF(trim(COALESCE(p_client_log_id, '')), '')
      )
      ON CONFLICT (user_id, client_log_id) WHERE client_log_id IS NOT NULL
      DO NOTHING
      RETURNING * INTO v_progress_log;

      IF v_progress_log.id IS NULL AND p_client_log_id IS NOT NULL THEN
        SELECT *
        INTO v_progress_log
        FROM public.progress_logs
        WHERE user_id = p_user_id
          AND client_log_id = trim(p_client_log_id);

        v_progress_idempotent := v_progress_log.id IS NOT NULL;
      ELSE
        v_inserted_progress := v_progress_log.id IS NOT NULL;
      END IF;
    END IF;

    IF v_book_before.pages IS NOT NULL AND p_page_number >= v_book_before.pages THEN
      v_should_complete := true;
    END IF;
  END IF;

  UPDATE public.books
  SET
    current_page = CASE
      WHEN p_page_number IS NOT NULL THEN GREATEST(COALESCE(current_page, 0), p_page_number)
      WHEN v_should_complete AND pages IS NOT NULL THEN GREATEST(COALESCE(current_page, 0), pages)
      ELSE current_page
    END,
    status = CASE
      WHEN v_should_complete THEN 'completed'
      WHEN status = 'to_read' AND (v_has_session_input OR p_page_number IS NOT NULL) THEN 'reading'
      ELSE status
    END,
    date_started = COALESCE(
      date_started,
      CASE
        WHEN v_should_complete OR v_has_session_input OR p_page_number IS NOT NULL
        THEN v_activity_date
        ELSE date_started
      END
    ),
    date_finished = CASE
      WHEN v_should_complete THEN COALESCE(date_finished, v_activity_date)
      ELSE date_finished
    END,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_book_id
    AND user_id = p_user_id
  RETURNING * INTO v_book_after;

  IF v_inserted_session OR v_session.id IS NOT NULL THEN
    PERFORM public.refresh_reading_streak_day(
      p_user_id,
      COALESCE(v_session.start_time, p_start_time, now())::DATE
    );
  END IF;

  IF v_inserted_progress OR v_progress_log.id IS NOT NULL THEN
    PERFORM public.refresh_reading_streak_day(
      p_user_id,
      COALESCE(v_progress_log.logged_at, now())::DATE
    );
  END IF;

  v_streak := public.recalculate_user_reading_streak(p_user_id);

  FOR v_goal IN
    SELECT *
    FROM public.goals
    WHERE user_id = p_user_id
      AND is_active = true
      AND COALESCE(is_completed, false) = false
      AND deleted_at IS NULL
    ORDER BY created_at DESC
  LOOP
    v_goal_current := 0;
    v_goal_target := CASE v_goal.goal_type
      WHEN 'books_count' THEN COALESCE(v_goal.target_books, 0)
      WHEN 'pages_count' THEN COALESCE(v_goal.target_pages, 0)
      WHEN 'reading_time' THEN COALESCE(v_goal.target_minutes, 0)
      ELSE 0
    END;

    IF v_goal.goal_type = 'books_count' THEN
      SELECT COUNT(*)::INTEGER
      INTO v_goal_current
      FROM public.books
      WHERE user_id = p_user_id
        AND deleted_at IS NULL
        AND status = 'completed'
        AND date_finished IS NOT NULL
        AND (v_goal.start_date IS NULL OR date_finished >= v_goal.start_date)
        AND (v_goal.end_date IS NULL OR date_finished <= v_goal.end_date);
    ELSIF v_goal.goal_type = 'pages_count' THEN
      SELECT COALESCE(SUM(COALESCE(current_page, 0)), 0)::INTEGER
      INTO v_goal_current
      FROM public.books
      WHERE user_id = p_user_id
        AND deleted_at IS NULL
        AND (v_goal.start_date IS NULL OR COALESCE(updated_at, created_at)::DATE >= v_goal.start_date)
        AND (v_goal.end_date IS NULL OR COALESCE(updated_at, created_at)::DATE <= v_goal.end_date);
    ELSIF v_goal.goal_type = 'reading_time' THEN
      SELECT COALESCE(SUM(minutes), 0)::INTEGER
      INTO v_goal_current
      FROM (
        SELECT COALESCE(duration, 0) AS minutes
        FROM public.reading_sessions
        WHERE user_id = p_user_id
          AND (v_goal.start_date IS NULL OR COALESCE(start_time, created_at)::DATE >= v_goal.start_date)
          AND (v_goal.end_date IS NULL OR COALESCE(start_time, created_at)::DATE <= v_goal.end_date)

        UNION ALL

        SELECT COALESCE(time_spent_minutes, 0) AS minutes
        FROM public.progress_logs
        WHERE user_id = p_user_id
          AND (v_goal.start_date IS NULL OR logged_at::DATE >= v_goal.start_date)
          AND (v_goal.end_date IS NULL OR logged_at::DATE <= v_goal.end_date)
      ) goal_minutes;
    END IF;

    v_goal_progress := CASE
      WHEN v_goal_target > 0 THEN LEAST(100, ROUND((v_goal_current::NUMERIC / v_goal_target::NUMERIC) * 100, 2))
      ELSE 0
    END;
    v_goal_completed := v_goal_target > 0 AND v_goal_current >= v_goal_target;

    IF v_goal_completed THEN
      UPDATE public.goals
      SET
        is_completed = true,
        completed_at = COALESCE(completed_at, timezone('utc'::text, now())),
        is_active = false,
        updated_at = timezone('utc'::text, now())
      WHERE id = v_goal.id;
    END IF;

    v_goal_result := jsonb_build_object(
      'goal_id', v_goal.id,
      'goal_type', v_goal.goal_type,
      'current_value', v_goal_current,
      'target_value', v_goal_target,
      'progress_percent', v_goal_progress,
      'completed', v_goal_completed
    );

    v_goal_results := v_goal_results || jsonb_build_array(v_goal_result);
  END LOOP;

  IF v_book_before.status IS DISTINCT FROM 'completed'
    AND v_book_after.status = 'completed' THEN
    INSERT INTO public.social_activities (user_id, activity_type, book_id, metadata)
    SELECT
      p_user_id,
      'book_completed',
      v_book_after.id,
      jsonb_build_object(
        'book_id', v_book_after.id,
        'title', v_book_after.title,
        'author', v_book_after.author,
        'completed_at', v_book_after.date_finished
      )
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.social_activities
      WHERE user_id = p_user_id
        AND activity_type = 'book_completed'
        AND (book_id = v_book_after.id OR metadata->>'book_id' = v_book_after.id::TEXT)
    )
    RETURNING jsonb_build_object(
      'id', id,
      'user_id', user_id,
      'activity_type', activity_type,
      'book_id', book_id,
      'metadata', metadata,
      'created_at', created_at,
      'visibility', visibility
    ) INTO v_activity;
  ELSIF v_book_before.status = 'to_read'
    AND v_book_after.status = 'reading' THEN
    INSERT INTO public.social_activities (user_id, activity_type, book_id, metadata)
    SELECT
      p_user_id,
      'book_started',
      v_book_after.id,
      jsonb_build_object(
        'book_id', v_book_after.id,
        'title', v_book_after.title,
        'author', v_book_after.author,
        'started_at', v_book_after.date_started
      )
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.social_activities
      WHERE user_id = p_user_id
        AND activity_type = 'book_started'
        AND (book_id = v_book_after.id OR metadata->>'book_id' = v_book_after.id::TEXT)
    )
    RETURNING jsonb_build_object(
      'id', id,
      'user_id', user_id,
      'activity_type', activity_type,
      'book_id', book_id,
      'metadata', metadata,
      'created_at', created_at,
      'visibility', visibility
    ) INTO v_activity;
  END IF;

  SELECT COALESCE(SUM(time_spent_minutes), 0)
  INTO v_total_time_from_logs
  FROM public.progress_logs
  WHERE book_id = p_book_id;

  SELECT COALESCE(SUM(duration), 0)
  INTO v_total_time_from_sessions
  FROM public.reading_sessions
  WHERE book_id = p_book_id;

  v_total_time_minutes := COALESCE(v_total_time_from_logs, 0) + COALESCE(v_total_time_from_sessions, 0);
  v_total_hours := v_total_time_minutes / 60.0;
  v_progress_percentage := CASE
    WHEN v_book_after.pages IS NOT NULL AND v_book_after.pages > 0
    THEN (COALESCE(v_book_after.current_page, 0)::NUMERIC / v_book_after.pages::NUMERIC) * 100
    ELSE 0
  END;
  v_pages_per_hour := CASE
    WHEN v_total_hours > 0 THEN COALESCE(v_book_after.current_page, 0)::NUMERIC / v_total_hours
    ELSE 0
  END;

  v_progress := jsonb_build_object(
    'current_page', COALESCE(v_book_after.current_page, 0),
    'total_pages', v_book_after.pages,
    'progress_percentage', ROUND(v_progress_percentage, 2),
    'pages_per_hour', ROUND(v_pages_per_hour, 2),
    'total_time_hours', ROUND(v_total_hours, 2),
    'status', v_book_after.status
  );

  v_awards := public.award_badges(
    p_user_id,
    CASE
      WHEN v_book_after.status = 'completed' THEN 'book_completed'
      WHEN v_has_session_input THEN 'reading_session_created'
      WHEN p_page_number IS NOT NULL THEN 'progress_logged'
      ELSE 'reading_activity_updated'
    END
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_idempotent', v_session_idempotent,
    'progress_idempotent', v_progress_idempotent,
    'idempotent', v_session_idempotent OR v_progress_idempotent,
    'session', CASE WHEN v_session.id IS NULL THEN NULL ELSE to_jsonb(v_session) END,
    'progress_log', CASE WHEN v_progress_log.id IS NULL THEN NULL ELSE to_jsonb(v_progress_log) END,
    'log_id', v_progress_log.id,
    'book', to_jsonb(v_book_after),
    'progress', v_progress,
    'streak', v_streak,
    'goal_progress', v_goal_results,
    'activity', v_activity,
    'awarded_badges', COALESCE(v_awards->'awarded_badges', '[]'::jsonb),
    'awarded_count', COALESCE((v_awards->>'awarded_count')::INTEGER, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_reading_session(
  p_user_id UUID,
  p_book_id UUID,
  p_start_time TIMESTAMP WITH TIME ZONE,
  p_end_time TIMESTAMP WITH TIME ZONE,
  p_duration_minutes INTEGER,
  p_client_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.complete_reading_transaction(
    p_user_id := p_user_id,
    p_book_id := p_book_id,
    p_start_time := p_start_time,
    p_end_time := p_end_time,
    p_duration_minutes := p_duration_minutes,
    p_client_session_id := p_client_session_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.log_progress_transaction(
  p_user_id UUID,
  p_book_id UUID,
  p_page_number INTEGER,
  p_chapter_number INTEGER DEFAULT NULL,
  p_paragraph_number INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_log_type TEXT DEFAULT 'manual',
  p_time_spent_minutes INTEGER DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_client_log_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.complete_reading_transaction(
    p_user_id := p_user_id,
    p_book_id := p_book_id,
    p_page_number := p_page_number,
    p_chapter_number := p_chapter_number,
    p_paragraph_number := p_paragraph_number,
    p_notes := p_notes,
    p_log_type := p_log_type,
    p_time_spent_minutes := p_time_spent_minutes,
    p_photo_url := p_photo_url,
    p_client_log_id := p_client_log_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_reading_transaction(
  UUID,
  UUID,
  TIMESTAMP WITH TIME ZONE,
  TIMESTAMP WITH TIME ZONE,
  INTEGER,
  TEXT,
  INTEGER,
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  BOOLEAN
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.complete_reading_transaction(
  UUID,
  UUID,
  TIMESTAMP WITH TIME ZONE,
  TIMESTAMP WITH TIME ZONE,
  INTEGER,
  TEXT,
  INTEGER,
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  BOOLEAN
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_reading_session(
  UUID,
  UUID,
  TIMESTAMP WITH TIME ZONE,
  TIMESTAMP WITH TIME ZONE,
  INTEGER,
  TEXT
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.log_progress_transaction(
  UUID,
  UUID,
  INTEGER,
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  INTEGER,
  TEXT,
  TEXT
) TO authenticated, service_role;
