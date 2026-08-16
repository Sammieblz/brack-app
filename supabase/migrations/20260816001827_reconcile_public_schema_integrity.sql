-- Reconcile public-schema objects that predate the protected migration
-- pipeline. Their versions were present in remote migration history, but the
-- hosted catalog did not reproduce a clean replay of the immutable ledger.
--
-- This is deliberately forward-only. Do not repair-mark or rewrite the old
-- migrations: later library wrappers depend on their current definitions.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

-- Preserve useful hosted indexes and restore indexes that existed only in a
-- clean replay. All operations are additive and safe to repeat.
CREATE INDEX IF NOT EXISTS idx_books_status
  ON public.books(status);
CREATE INDEX IF NOT EXISTS idx_books_user_id
  ON public.books(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id
  ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name
  ON public.profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_sessions_book_id
  ON public.reading_sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON public.reading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_social_activities_book
  ON public.social_activities(book_id)
  WHERE book_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_activities_created
  ON public.social_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_activities_type
  ON public.social_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_social_activities_user
  ON public.social_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_social_activities_list_id_fk
  ON public.social_activities(list_id);
CREATE INDEX IF NOT EXISTS idx_social_activities_review_id_fk
  ON public.social_activities(review_id);

-- Retain the stricter hosted activity invariants and make them reproducible on
-- a new database. The update is bounded to legacy invalid rows.
UPDATE public.social_activities
SET created_at = NOW()
WHERE created_at IS NULL;

ALTER TABLE public.social_activities
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.social_activities'::regclass
      AND conname = 'social_activities_visibility_check'
  ) THEN
    ALTER TABLE public.social_activities
      ADD CONSTRAINT social_activities_visibility_check
      CHECK (visibility IN ('public', 'followers', 'private')) NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.social_activities
  VALIDATE CONSTRAINT social_activities_visibility_check;
ALTER TABLE public.social_activities REPLICA IDENTITY FULL;

-- Align delete behavior with the clean ledger. Existing constraints already
-- prove referential validity, so validation does not permit orphaned rows.
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_id_fkey,
  ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_id_fkey;

ALTER TABLE public.social_activities
  DROP CONSTRAINT social_activities_badge_id_fkey,
  ADD CONSTRAINT social_activities_badge_id_fkey
    FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON DELETE CASCADE NOT VALID,
  DROP CONSTRAINT social_activities_book_id_fkey,
  ADD CONSTRAINT social_activities_book_id_fkey
    FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE NOT VALID,
  DROP CONSTRAINT social_activities_list_id_fkey,
  ADD CONSTRAINT social_activities_list_id_fkey
    FOREIGN KEY (list_id) REFERENCES public.book_lists(id) ON DELETE CASCADE NOT VALID,
  DROP CONSTRAINT social_activities_review_id_fkey,
  ADD CONSTRAINT social_activities_review_id_fkey
    FOREIGN KEY (review_id) REFERENCES public.book_reviews(id) ON DELETE CASCADE NOT VALID;

ALTER TABLE public.social_activities
  VALIDATE CONSTRAINT social_activities_badge_id_fkey,
  VALIDATE CONSTRAINT social_activities_book_id_fkey,
  VALIDATE CONSTRAINT social_activities_list_id_fkey,
  VALIDATE CONSTRAINT social_activities_review_id_fkey;

-- Restore the shelf-aware private helper. The current public wrapper retains
-- UUID-collision repair and series behavior. Serialize position allocation per
-- reader so concurrent creates cannot choose the same next position.
CREATE OR REPLACE FUNCTION public.add_library_book_without_series(
  p_user_id UUID,
  p_book JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requested_id UUID := NULLIF(p_book->>'id', '')::UUID;
  v_title TEXT := NULLIF(trim(p_book->>'title'), '');
  v_author TEXT := NULLIF(trim(p_book->>'author'), '');
  v_isbn TEXT := NULLIF(trim(p_book->>'isbn'), '');
  v_normalized_isbn TEXT := public.normalize_book_isbn(p_book->>'isbn');
  v_normalized_title TEXT := public.normalize_book_text(p_book->>'title');
  v_normalized_author TEXT := public.normalize_book_text(p_book->>'author');
  v_existing RECORD;
  v_restored RECORD;
  v_inserted RECORD;
  v_pages INTEGER := NULLIF(p_book->>'pages', '')::INTEGER;
  v_chapters INTEGER := NULLIF(p_book->>'chapters', '')::INTEGER;
  v_current_page INTEGER := COALESCE(NULLIF(p_book->>'current_page', '')::INTEGER, 0);
  v_requested_position INTEGER := NULLIF(p_book->>'shelf_position', '')::INTEGER;
  v_next_position INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Book title is required';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('library-shelf:' || p_user_id::TEXT, 0)
  );

  SELECT COALESCE(MAX(shelf_position), 0) + 1
  INTO v_next_position
  FROM public.books
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;

  IF v_requested_id IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.books
    WHERE id = v_requested_id
      AND user_id = p_user_id
      AND deleted_at IS NULL
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'action', 'created',
        'book_id', v_existing.id,
        'book', to_jsonb(v_existing)
      );
    END IF;
  END IF;

  IF v_normalized_isbn IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.books
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND public.normalize_book_isbn(isbn) = v_normalized_isbn
    LIMIT 1;
  ELSE
    SELECT *
    INTO v_existing
    FROM public.books
    WHERE user_id = p_user_id
      AND deleted_at IS NULL
      AND public.normalize_book_isbn(isbn) IS NULL
      AND public.normalize_book_text(title) = v_normalized_title
      AND public.normalize_book_text(author) = v_normalized_author
    LIMIT 1;
  END IF;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'book_exists',
      'message', 'Book already exists in your library',
      'book_id', v_existing.id,
      'book', to_jsonb(v_existing)
    );
  END IF;

  IF v_normalized_isbn IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.books
    WHERE user_id = p_user_id
      AND deleted_at IS NOT NULL
      AND public.normalize_book_isbn(isbn) = v_normalized_isbn
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;
  ELSE
    SELECT *
    INTO v_existing
    FROM public.books
    WHERE user_id = p_user_id
      AND deleted_at IS NOT NULL
      AND public.normalize_book_isbn(isbn) IS NULL
      AND public.normalize_book_text(title) = v_normalized_title
      AND public.normalize_book_text(author) = v_normalized_author
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF FOUND THEN
    UPDATE public.books
    SET
      title = v_title,
      author = v_author,
      isbn = v_isbn,
      genre = NULLIF(trim(p_book->>'genre'), ''),
      pages = v_pages,
      chapters = v_chapters,
      cover_url = NULLIF(trim(p_book->>'cover_url'), ''),
      description = NULLIF(trim(p_book->>'description'), ''),
      status = COALESCE(NULLIF(trim(p_book->>'status'), ''), 'to_read'),
      tags = CASE
        WHEN jsonb_typeof(p_book->'tags') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(p_book->'tags'))
        ELSE tags
      END,
      metadata = CASE
        WHEN jsonb_typeof(p_book->'metadata') = 'object' THEN p_book->'metadata'
        ELSE metadata
      END,
      current_page = v_current_page,
      date_started = NULLIF(p_book->>'date_started', '')::DATE,
      date_finished = NULLIF(p_book->>'date_finished', '')::DATE,
      rating = NULLIF(p_book->>'rating', '')::INTEGER,
      notes = NULLIF(trim(p_book->>'notes'), ''),
      source_provider = NULLIF(trim(p_book->>'source_provider'), ''),
      source_id = NULLIF(trim(p_book->>'source_id'), ''),
      shelf_position = COALESCE(v_requested_position, v_next_position),
      deleted_at = NULL,
      updated_at = NOW()
    WHERE id = v_existing.id
    RETURNING * INTO v_restored;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'restored',
      'book_id', v_restored.id,
      'book', to_jsonb(v_restored)
    );
  END IF;

  INSERT INTO public.books (
    id,
    user_id,
    title,
    author,
    isbn,
    genre,
    pages,
    chapters,
    cover_url,
    description,
    status,
    tags,
    metadata,
    current_page,
    date_started,
    date_finished,
    rating,
    notes,
    source_provider,
    source_id,
    shelf_position
  )
  VALUES (
    COALESCE(v_requested_id, gen_random_uuid()),
    p_user_id,
    v_title,
    v_author,
    v_isbn,
    NULLIF(trim(p_book->>'genre'), ''),
    v_pages,
    v_chapters,
    NULLIF(trim(p_book->>'cover_url'), ''),
    NULLIF(trim(p_book->>'description'), ''),
    COALESCE(NULLIF(trim(p_book->>'status'), ''), 'to_read'),
    CASE
      WHEN jsonb_typeof(p_book->'tags') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(p_book->'tags'))
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(p_book->'metadata') = 'object' THEN p_book->'metadata'
      ELSE NULL
    END,
    v_current_page,
    NULLIF(p_book->>'date_started', '')::DATE,
    NULLIF(p_book->>'date_finished', '')::DATE,
    NULLIF(p_book->>'rating', '')::INTEGER,
    NULLIF(trim(p_book->>'notes'), ''),
    NULLIF(trim(p_book->>'source_provider'), ''),
    NULLIF(trim(p_book->>'source_id'), ''),
    COALESCE(v_requested_position, v_next_position)
  )
  RETURNING * INTO v_inserted;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'created',
    'book_id', v_inserted.id,
    'book', to_jsonb(v_inserted)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'book_exists',
      'message', 'Book already exists in your library'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.add_library_book_without_series(UUID, JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_library_book_without_series(UUID, JSONB)
TO service_role;

-- Trigger helpers are not client RPCs. Keep them unavailable to API roles,
-- while ensuring the backend role can execute every trigger path explicitly.
DO $$
DECLARE
  function_name TEXT;
  function_signature REGPROCEDURE;
BEGIN
  FOREACH function_name IN ARRAY ARRAY[
    'create_badge_activity',
    'create_book_activity',
    'create_follow_activity',
    'create_list_activity',
    'create_review_activity',
    'evaluate_badges_after_domain_event',
    'gamification_badge_insert_trigger',
    'gamification_book_status_trigger',
    'gamification_progress_insert_trigger',
    'gamification_session_insert_trigger'
  ]
  LOOP
    SELECT procedure.oid::REGPROCEDURE
    INTO function_signature
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = function_name
      AND procedure.pronargs = 0;

    IF function_signature IS NULL THEN
      RAISE EXCEPTION 'Required trigger helper is missing: %', function_name;
    END IF;

    EXECUTE FORMAT(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_signature
    );
    EXECUTE FORMAT(
      'GRANT EXECUTE ON FUNCTION %s TO service_role',
      function_signature
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_reading_session_row()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_reading_session_row()
TO service_role;

NOTIFY pgrst, 'reload schema';
