-- Persist custom ordering for the interactive Library bookshelf view.
ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS shelf_position INTEGER;

WITH ranked AS (
  SELECT
    id,
    COALESCE(MAX(shelf_position) OVER (PARTITION BY user_id), 0)
      + ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
      ) AS next_position
  FROM public.books
  WHERE deleted_at IS NULL
    AND shelf_position IS NULL
)
UPDATE public.books AS b
SET shelf_position = ranked.next_position
FROM ranked
WHERE b.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_books_user_shelf_position
ON public.books(user_id, shelf_position)
WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.reorder_library_shelf(
  p_user_id UUID,
  p_book_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book_ids UUID[] := COALESCE(p_book_ids, ARRAY[]::UUID[]);
  v_total_ids INTEGER := COALESCE(cardinality(COALESCE(p_book_ids, ARRAY[]::UUID[])), 0);
  v_distinct_ids INTEGER;
  v_invalid_ids INTEGER;
  v_updated_count INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_books JSONB := '[]'::JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(DISTINCT book_id)
  INTO v_distinct_ids
  FROM unnest(v_book_ids) AS requested(book_id);

  IF COALESCE(v_distinct_ids, 0) <> v_total_ids THEN
    RAISE EXCEPTION 'Duplicate books are not allowed in shelf order';
  END IF;

  SELECT COUNT(*)
  INTO v_invalid_ids
  FROM unnest(v_book_ids) AS requested(book_id)
  LEFT JOIN public.books AS b
    ON b.id = requested.book_id
    AND b.user_id = p_user_id
    AND b.deleted_at IS NULL
  WHERE b.id IS NULL;

  IF COALESCE(v_invalid_ids, 0) > 0 THEN
    RAISE EXCEPTION 'Shelf order contains books outside your active library';
  END IF;

  WITH ordered AS (
    SELECT
      requested.book_id,
      ROW_NUMBER() OVER (ORDER BY requested.ordinality)::INTEGER AS position
    FROM unnest(v_book_ids) WITH ORDINALITY AS requested(book_id, ordinality)
  ),
  updated AS (
    UPDATE public.books AS b
    SET
      shelf_position = ordered.position,
      updated_at = v_now
    FROM ordered
    WHERE b.id = ordered.book_id
      AND b.user_id = p_user_id
      AND b.deleted_at IS NULL
    RETURNING b.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  WITH omitted AS (
    SELECT
      b.id,
      (v_updated_count + ROW_NUMBER() OVER (
        ORDER BY b.shelf_position ASC NULLS LAST, b.updated_at DESC NULLS LAST, b.created_at DESC NULLS LAST, b.id
      ))::INTEGER AS position
    FROM public.books AS b
    WHERE b.user_id = p_user_id
      AND b.deleted_at IS NULL
      AND NOT (b.id = ANY(v_book_ids))
  )
  UPDATE public.books AS b
  SET
    shelf_position = omitted.position,
    updated_at = CASE
      WHEN b.shelf_position IS DISTINCT FROM omitted.position THEN v_now
      ELSE b.updated_at
    END
  FROM omitted
  WHERE b.id = omitted.id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'shelf_position', b.shelf_position,
        'updated_at', b.updated_at
      )
      ORDER BY b.shelf_position ASC NULLS LAST, b.updated_at DESC NULLS LAST, b.created_at DESC NULLS LAST
    ),
    '[]'::JSONB
  )
  INTO v_books
  FROM public.books AS b
  WHERE b.user_id = p_user_id
    AND b.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'books', v_books
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_library_shelf(UUID, UUID[]) TO authenticated;

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

GRANT EXECUTE ON FUNCTION public.add_library_book(UUID, JSONB) TO authenticated;
