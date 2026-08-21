-- Imported history should be restorable and idempotent without awarding new
-- reading rewards for activity that happened outside this installation.

BEGIN;

ALTER TABLE public.progress_logs
DROP CONSTRAINT IF EXISTS progress_logs_log_type_check;

ALTER TABLE public.progress_logs
ADD CONSTRAINT progress_logs_log_type_check
CHECK (
  log_type IN ('manual', 'timer_based', 'automatic', 'correction', 'import')
);

CREATE OR REPLACE FUNCTION public.gamification_book_status_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_series_completed INTEGER;
  v_threshold INTEGER;
BEGIN
  -- Suppress the import transition itself, but do not permanently suppress
  -- rewards when a reader later starts or completes an imported book.
  IF (
    COALESCE(OLD.metadata->>'import_source', '') = ''
    AND COALESCE(NEW.metadata->>'import_source', '') <> ''
  ) OR (
    COALESCE(OLD.source_provider, '') NOT IN ('brack_import', 'goodreads_import')
    AND COALESCE(NEW.source_provider, '') IN ('brack_import', 'goodreads_import')
  )
  THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'to_read' AND NEW.status = 'reading' THEN
    PERFORM public.apply_gamification_event(
      NEW.user_id,
      'book_started',
      'book-started:' || NEW.id::TEXT,
      'book',
      NEW.id::TEXT,
      jsonb_build_object('title', NEW.title),
      now()
    );
  END IF;

  IF OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed' THEN
    PERFORM public.apply_gamification_event(
      NEW.user_id,
      'book_completed',
      'book-completed:' || NEW.id::TEXT,
      'book',
      NEW.id::TEXT,
      jsonb_build_object(
        'title', NEW.title,
        'book_pages', COALESCE(NEW.pages, 0),
        'series_name', NEW.series_name
      ),
      now()
    );
    PERFORM public.advance_user_quests(
      NEW.user_id,
      'books_completed',
      1,
      'book-completed:' || NEW.id::TEXT,
      now()
    );

    IF NEW.series_name IS NOT NULL THEN
      PERFORM public.advance_user_quests(
        NEW.user_id,
        'series_books_completed',
        1,
        'series-book-completed:' || NEW.id::TEXT,
        now()
      );

      SELECT COUNT(*) INTO v_series_completed
      FROM public.books
      WHERE user_id = NEW.user_id
        AND deleted_at IS NULL
        AND status = 'completed'
        AND lower(series_name) = lower(NEW.series_name);

      FOREACH v_threshold IN ARRAY ARRAY[2, 3, 5]
      LOOP
        IF v_series_completed >= v_threshold THEN
          PERFORM public.apply_gamification_event(
            NEW.user_id,
            'series_milestone',
            'series:' || md5(lower(NEW.series_name)) || ':' || v_threshold::TEXT,
            'series',
            NEW.series_name,
            jsonb_build_object('series_name', NEW.series_name, 'threshold', v_threshold),
            now()
          );
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gamification_session_insert_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.client_session_id, '') LIKE 'import:%' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.duration, 0) >= 5 THEN
    PERFORM public.apply_gamification_event(
      NEW.user_id,
      'reading_session',
      'reading-session:' || NEW.id::TEXT,
      'reading_session',
      NEW.id::TEXT,
      jsonb_build_object('duration_minutes', NEW.duration, 'book_id', NEW.book_id),
      COALESCE(NEW.end_time, NEW.created_at, now())
    );
    PERFORM public.advance_user_quests(
      NEW.user_id,
      'reading_minutes',
      NEW.duration,
      'reading-session:' || NEW.id::TEXT,
      COALESCE(NEW.end_time, NEW.created_at, now())
    );
    PERFORM public.advance_user_quests(
      NEW.user_id,
      'sessions',
      1,
      'reading-session:' || NEW.id::TEXT,
      COALESCE(NEW.end_time, NEW.created_at, now())
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gamification_session_insert_trigger()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gamification_book_status_trigger()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gamification_progress_insert_trigger()
FROM PUBLIC, anon, authenticated;

COMMENT ON CONSTRAINT progress_logs_log_type_check ON public.progress_logs IS
  'Import and correction logs are valid history but are excluded from gamification triggers.';

COMMIT;
