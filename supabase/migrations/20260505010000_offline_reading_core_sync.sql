-- Offline reading-core sync support.
-- Client-created IDs let local records survive offline and sync without remapping.

ALTER TABLE public.progress_logs
ADD COLUMN IF NOT EXISTS client_log_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_logs_user_client_log_id
ON public.progress_logs(user_id, client_log_id)
WHERE client_log_id IS NOT NULL;

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
DECLARE
  v_progress_log_id UUID;
  v_book_record RECORD;
  v_updates JSONB;
  v_total_time_minutes INTEGER;
  v_total_time_from_logs INTEGER;
  v_total_time_from_sessions INTEGER;
  v_total_hours NUMERIC;
  v_progress_percentage NUMERIC;
  v_pages_per_hour NUMERIC;
  v_result JSONB;
BEGIN
  SELECT pages, current_page, status
  INTO v_book_record
  FROM public.books
  WHERE id = p_book_id AND user_id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book not found or access denied';
  END IF;

  IF p_client_log_id IS NOT NULL THEN
    SELECT id
    INTO v_progress_log_id
    FROM public.progress_logs
    WHERE user_id = p_user_id
      AND client_log_id = p_client_log_id
    LIMIT 1;
  END IF;

  IF v_progress_log_id IS NULL THEN
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
      p_log_type,
      p_time_spent_minutes,
      p_photo_url,
      NULLIF(p_client_log_id, '')
    )
    RETURNING id INTO v_progress_log_id;
  END IF;

  v_updates := jsonb_build_object('current_page', p_page_number);

  IF v_book_record.pages IS NOT NULL AND p_page_number >= v_book_record.pages AND v_book_record.status != 'completed' THEN
    v_updates := v_updates || jsonb_build_object(
      'status', 'completed',
      'date_finished', CURRENT_DATE
    );
  END IF;

  UPDATE public.books
  SET
    current_page = GREATEST(COALESCE(current_page, 0), (v_updates->>'current_page')::INTEGER),
    status = COALESCE((v_updates->>'status')::TEXT, status),
    date_finished = COALESCE((v_updates->>'date_finished')::DATE, date_finished),
    date_started = COALESCE(date_started, CASE WHEN p_page_number > 0 THEN CURRENT_DATE ELSE date_started END),
    updated_at = NOW()
  WHERE id = p_book_id;

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
    WHEN v_book_record.pages IS NOT NULL AND v_book_record.pages > 0
    THEN (p_page_number::NUMERIC / v_book_record.pages::NUMERIC) * 100
    ELSE 0
  END;
  v_pages_per_hour := CASE
    WHEN v_total_hours > 0 THEN p_page_number::NUMERIC / v_total_hours
    ELSE 0
  END;

  v_result := jsonb_build_object(
    'success', true,
    'log_id', v_progress_log_id,
    'progress', jsonb_build_object(
      'current_page', p_page_number,
      'total_pages', v_book_record.pages,
      'progress_percentage', ROUND(v_progress_percentage, 2),
      'pages_per_hour', ROUND(v_pages_per_hour, 2),
      'total_time_hours', ROUND(v_total_hours, 2),
      'status', COALESCE((v_updates->>'status')::TEXT, v_book_record.status)
    )
  );

  RETURN v_result;
END;
$$;

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
) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_library_book(
  p_user_id UUID,
  p_book JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    source_id
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
    NULLIF(trim(p_book->>'source_id'), '')
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

GRANT EXECUTE ON FUNCTION public.add_library_book(UUID, JSONB) TO authenticated;
