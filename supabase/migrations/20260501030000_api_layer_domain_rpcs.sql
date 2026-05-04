-- First API-layer domain RPCs for dashboard, timer sessions, and badge awards.

ALTER TABLE public.reading_sessions
ADD COLUMN IF NOT EXISTS client_session_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_sessions_user_client_session_id
ON public.reading_sessions(user_id, client_session_id)
WHERE client_session_id IS NOT NULL;

WITH ranked_user_badges AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, badge_id
      ORDER BY earned_at ASC NULLS LAST, id ASC
    ) AS row_num
  FROM public.user_badges
)
DELETE FROM public.user_badges user_badges
USING ranked_user_badges ranked
WHERE user_badges.id = ranked.id
  AND ranked.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_badges_user_badge_id
ON public.user_badges(user_id, badge_id);

CREATE OR REPLACE FUNCTION public.award_badges(
  p_user_id UUID,
  p_event TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed_books INTEGER := 0;
  v_total_books INTEGER := 0;
  v_long_books_completed INTEGER := 0;
  v_genre_count INTEGER := 0;
  v_recent_completed_books INTEGER := 0;
  v_total_minutes INTEGER := 0;
  v_has_early_session BOOLEAN := false;
  v_max_session_streak INTEGER := 0;
  v_awarded JSONB := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to award badges for this user';
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'completed' AND COALESCE(pages, 0) >= 500)::INTEGER,
    COUNT(DISTINCT genre) FILTER (WHERE genre IS NOT NULL)::INTEGER,
    COUNT(*) FILTER (
      WHERE status = 'completed'
        AND date_finished IS NOT NULL
        AND date_finished >= CURRENT_DATE - INTERVAL '1 month'
    )::INTEGER
  INTO
    v_total_books,
    v_completed_books,
    v_long_books_completed,
    v_genre_count,
    v_recent_completed_books
  FROM public.books
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;

  SELECT
    COALESCE(SUM(GREATEST(COALESCE(duration, 0), 0)), 0)::INTEGER,
    COALESCE(BOOL_OR(EXTRACT(HOUR FROM start_time) >= 5 AND EXTRACT(HOUR FROM start_time) < 8), false)
  INTO v_total_minutes, v_has_early_session
  FROM public.reading_sessions
  WHERE user_id = p_user_id;

  WITH session_days AS (
    SELECT DISTINCT COALESCE(start_time, created_at)::DATE AS activity_date
    FROM public.reading_sessions
    WHERE user_id = p_user_id
      AND COALESCE(start_time, created_at) IS NOT NULL
  ),
  grouped_days AS (
    SELECT
      activity_date,
      activity_date - ((ROW_NUMBER() OVER (ORDER BY activity_date))::INTEGER) AS island_key
    FROM session_days
  )
  SELECT COALESCE(MAX(day_count), 0)::INTEGER
  INTO v_max_session_streak
  FROM (
    SELECT COUNT(*) AS day_count
    FROM grouped_days
    GROUP BY island_key
  ) streaks;

  WITH eligible_badges AS (
    SELECT id
    FROM public.badges
    WHERE
      (title = 'First Book' AND v_total_books >= 1)
      OR (title = 'Bookworm' AND v_completed_books >= 10)
      OR (title = 'Century Reader' AND v_completed_books >= 100)
      OR (title = 'Marathon Reader' AND v_long_books_completed >= 1)
      OR (title = 'Genre Explorer' AND v_genre_count >= 5)
      OR (title = 'Speed Reader' AND v_recent_completed_books >= 5)
      OR (title = 'Dedicated Reader' AND v_max_session_streak >= 7)
      OR (title = 'Night Owl' AND v_total_minutes >= 6000)
      OR (title = 'Early Bird' AND v_has_early_session)
      OR (title = 'Consistent Reader' AND v_max_session_streak >= 30)
  ),
  inserted_badges AS (
    INSERT INTO public.user_badges (user_id, badge_id)
    SELECT p_user_id, id
    FROM eligible_badges
    ON CONFLICT (user_id, badge_id) DO NOTHING
    RETURNING badge_id, earned_at
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', badges.id,
        'title', badges.title,
        'description', badges.description,
        'icon_url', badges.icon_url,
        'created_at', badges.created_at,
        'earned_at', inserted_badges.earned_at
      )
      ORDER BY inserted_badges.earned_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_awarded
  FROM inserted_badges
  JOIN public.badges ON badges.id = inserted_badges.badge_id;

  RETURN jsonb_build_object(
    'success', true,
    'event', p_event,
    'awarded_badges', v_awarded,
    'awarded_count', jsonb_array_length(v_awarded)
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
DECLARE
  v_session public.reading_sessions;
  v_book public.books;
  v_streak JSONB;
  v_awards JSONB;
  v_activity_date DATE;
  v_idempotent BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL OR p_book_id IS NULL THEN
    RAISE EXCEPTION 'User and book are required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to create a session for this user';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 THEN
    RAISE EXCEPTION 'Duration must be at least one minute';
  END IF;

  IF p_start_time IS NULL OR p_end_time IS NULL OR p_end_time < p_start_time THEN
    RAISE EXCEPTION 'Invalid session time range';
  END IF;

  SELECT *
  INTO v_book
  FROM public.books
  WHERE id = p_book_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found or access denied';
  END IF;

  IF p_client_session_id IS NOT NULL THEN
    SELECT *
    INTO v_session
    FROM public.reading_sessions
    WHERE user_id = p_user_id
      AND client_session_id = p_client_session_id;

    v_idempotent := v_session.id IS NOT NULL;
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
      NULLIF(p_client_session_id, '')
    )
    ON CONFLICT (user_id, client_session_id) WHERE client_session_id IS NOT NULL
    DO NOTHING
    RETURNING * INTO v_session;

    IF v_session.id IS NULL AND p_client_session_id IS NOT NULL THEN
      SELECT *
      INTO v_session
      FROM public.reading_sessions
      WHERE user_id = p_user_id
        AND client_session_id = p_client_session_id;

      v_idempotent := true;
    END IF;
  END IF;

  IF v_book.status = 'to_read' THEN
    UPDATE public.books
    SET
      status = 'reading',
      date_started = COALESCE(date_started, COALESCE(v_session.start_time, p_start_time)::DATE),
      updated_at = timezone('utc'::text, now())
    WHERE id = p_book_id
      AND user_id = p_user_id
    RETURNING * INTO v_book;
  ELSE
    UPDATE public.books
    SET updated_at = timezone('utc'::text, now())
    WHERE id = p_book_id
      AND user_id = p_user_id
    RETURNING * INTO v_book;
  END IF;

  v_activity_date := COALESCE(v_session.start_time, v_session.created_at)::DATE;
  PERFORM public.refresh_reading_streak_day(p_user_id, v_activity_date);
  v_streak := public.recalculate_user_reading_streak(p_user_id);
  v_awards := public.award_badges(p_user_id, 'reading_session_created');

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', v_idempotent,
    'session', to_jsonb(v_session),
    'book', to_jsonb(v_book),
    'streak', v_streak,
    'awarded_badges', COALESCE(v_awards->'awarded_badges', '[]'::jsonb),
    'awarded_count', COALESCE((v_awards->>'awarded_count')::INTEGER, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_dashboard_stats(
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
  v_continue_books JSONB := '[]'::jsonb;
  v_active_goal JSONB := NULL;
  v_today_summary JSONB := '{}'::jsonb;
  v_streak_summary JSONB := '{}'::jsonb;
  v_core_stats JSONB := '{}'::jsonb;
  v_recent_activity JSONB := '[]'::jsonb;
  v_achievement_preview JSONB := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not allowed to load dashboard stats for this user';
  END IF;

  WITH progress_activity AS (
    SELECT book_id, MAX(logged_at) AS last_at
    FROM public.progress_logs
    WHERE user_id = p_user_id
    GROUP BY book_id
  ),
  session_activity AS (
    SELECT book_id, MAX(COALESCE(start_time, created_at)) AS last_at
    FROM public.reading_sessions
    WHERE user_id = p_user_id
      AND book_id IS NOT NULL
    GROUP BY book_id
  ),
  ranked_books AS (
    SELECT
      books.*,
      GREATEST(
        COALESCE(progress_activity.last_at, '-infinity'::timestamp with time zone),
        COALESCE(session_activity.last_at, '-infinity'::timestamp with time zone),
        COALESCE(books.updated_at, '-infinity'::timestamp with time zone),
        COALESCE(books.date_started::timestamp with time zone, '-infinity'::timestamp with time zone),
        COALESCE(books.created_at, '-infinity'::timestamp with time zone)
      ) AS last_activity_at,
      CASE
        WHEN progress_activity.last_at IS NOT NULL
          AND progress_activity.last_at >= COALESCE(session_activity.last_at, '-infinity'::timestamp with time zone)
          AND progress_activity.last_at >= COALESCE(books.updated_at, '-infinity'::timestamp with time zone)
          THEN 'progress_log'
        WHEN session_activity.last_at IS NOT NULL
          AND session_activity.last_at >= COALESCE(books.updated_at, '-infinity'::timestamp with time zone)
          THEN 'reading_session'
        WHEN books.updated_at IS NOT NULL THEN 'book_update'
        WHEN books.date_started IS NOT NULL THEN 'date_started'
        ELSE 'created'
      END AS last_activity_type,
      CASE WHEN books.status = 'reading' OR COALESCE(books.current_page, 0) > 0 THEN 2
        WHEN books.status = 'to_read' THEN 1
        ELSE 0
      END AS priority
    FROM public.books
    LEFT JOIN progress_activity ON progress_activity.book_id = books.id
    LEFT JOIN session_activity ON session_activity.book_id = books.id
    WHERE books.user_id = p_user_id
      AND books.deleted_at IS NULL
      AND books.status IN ('reading', 'to_read')
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'book', to_jsonb(ranked_books),
      'lastActivityAt', ranked_books.last_activity_at,
      'lastActivityType', ranked_books.last_activity_type,
      'progressPercent', CASE
        WHEN COALESCE(ranked_books.pages, 0) > 0
          THEN LEAST(100, ROUND((COALESCE(ranked_books.current_page, 0)::NUMERIC / ranked_books.pages::NUMERIC) * 100))::INTEGER
        ELSE 0
      END,
      'ctaLabel', CASE WHEN ranked_books.priority = 2 THEN 'Continue' ELSE 'Start reading' END
    )
    ORDER BY ranked_books.priority DESC, ranked_books.last_activity_at DESC
  ), '[]'::jsonb)
  INTO v_continue_books
  FROM (
    SELECT *
    FROM ranked_books
    ORDER BY priority DESC, last_activity_at DESC
    LIMIT v_recent_limit
  ) ranked_books;

  SELECT to_jsonb(goals)
  INTO v_active_goal
  FROM public.goals
  WHERE user_id = p_user_id
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT jsonb_build_object(
    'minutes', COALESCE(SUM(duration), 0),
    'sessionCount', COUNT(*),
    'progressMinutes', (
      SELECT COALESCE(SUM(time_spent_minutes), 0)
      FROM public.progress_logs
      WHERE user_id = p_user_id
        AND logged_at::DATE = CURRENT_DATE
    ),
    'progressLogCount', (
      SELECT COUNT(*)
      FROM public.progress_logs
      WHERE user_id = p_user_id
        AND logged_at::DATE = CURRENT_DATE
    )
  )
  INTO v_today_summary
  FROM public.reading_sessions
  WHERE user_id = p_user_id
    AND COALESCE(start_time, created_at)::DATE = CURRENT_DATE;

  SELECT jsonb_build_object(
    'currentStreak', COALESCE(current_streak, 0),
    'longestStreak', COALESCE(longest_streak, 0),
    'lastReadingDate', last_reading_date,
    'freezeUsedAt', streak_freeze_used_at
  )
  INTO v_streak_summary
  FROM public.profiles
  WHERE id = p_user_id;

  SELECT jsonb_build_object(
    'totalBooks', COUNT(*),
    'completedBooks', COUNT(*) FILTER (WHERE status = 'completed'),
    'readingBooks', COUNT(*) FILTER (WHERE status = 'reading'),
    'toReadBooks', COUNT(*) FILTER (WHERE status = 'to_read'),
    'pagesRead', COALESCE(SUM(COALESCE(current_page, 0)), 0),
    'readingMinutes', (
      SELECT COALESCE(SUM(duration), 0)
      FROM public.reading_sessions
      WHERE user_id = p_user_id
    ) + (
      SELECT COALESCE(SUM(time_spent_minutes), 0)
      FROM public.progress_logs
      WHERE user_id = p_user_id
    )
  )
  INTO v_core_stats
  FROM public.books
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;

  WITH activity AS (
    SELECT
      ('session-' || reading_sessions.id::TEXT) AS id,
      'reading_session' AS type,
      COALESCE(reading_sessions.start_time, reading_sessions.created_at) AS timestamp,
      jsonb_build_object(
        'duration', reading_sessions.duration,
        'book_id', reading_sessions.book_id,
        'title', books.title
      ) AS details
    FROM public.reading_sessions
    LEFT JOIN public.books ON books.id = reading_sessions.book_id
    WHERE reading_sessions.user_id = p_user_id

    UNION ALL

    SELECT
      ('progress-' || progress_logs.id::TEXT) AS id,
      'progress_logged' AS type,
      progress_logs.logged_at AS timestamp,
      jsonb_build_object(
        'page_number', progress_logs.page_number,
        'book_id', progress_logs.book_id,
        'title', books.title
      ) AS details
    FROM public.progress_logs
    LEFT JOIN public.books ON books.id = progress_logs.book_id
    WHERE progress_logs.user_id = p_user_id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(activity) ORDER BY activity.timestamp DESC), '[]'::jsonb)
  INTO v_recent_activity
  FROM (
    SELECT *
    FROM activity
    ORDER BY timestamp DESC
    LIMIT v_recent_limit
  ) activity;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', badges.id,
      'title', badges.title,
      'description', badges.description,
      'icon_url', badges.icon_url,
      'earned_at', user_badges.earned_at
    )
    ORDER BY user_badges.earned_at DESC
  ), '[]'::jsonb)
  INTO v_achievement_preview
  FROM (
    SELECT *
    FROM public.user_badges
    WHERE user_id = p_user_id
    ORDER BY earned_at DESC
    LIMIT 5
  ) user_badges
  JOIN public.badges ON badges.id = user_badges.badge_id;

  RETURN jsonb_build_object(
    'continueBooks', v_continue_books,
    'activeGoal', v_active_goal,
    'today', v_today_summary,
    'streak', COALESCE(v_streak_summary, '{}'::jsonb),
    'stats', v_core_stats,
    'recentActivity', v_recent_activity,
    'achievements', v_achievement_preview
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_badges(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_reading_session(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_dashboard_stats(UUID, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.award_badges(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_reading_session(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_dashboard_stats(UUID, INTEGER) TO authenticated, service_role;
