-- Backend-owned library book identity and duplicate prevention.
-- Duplicate policy:
--   1. ISBN is authoritative when present.
--   2. Title + author is used only when ISBN is missing.
--   3. Soft-deleted duplicates are restored instead of creating a new row.

ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS source_provider TEXT,
ADD COLUMN IF NOT EXISTS source_id TEXT;

CREATE OR REPLACE FUNCTION public.normalize_book_isbn(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(lower(coalesce(value, '')), '[^0-9x]', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.normalize_book_text(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(lower(coalesce(value, '')), '\s+', ' ', 'g'));
$$;

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY user_id, public.normalize_book_isbn(isbn)
      ORDER BY
        COALESCE(current_page, 0) DESC,
        CASE WHEN cover_url IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN pages IS NOT NULL THEN 0 ELSE 1 END,
        created_at ASC NULLS LAST,
        id ASC
    ) AS keep_id
  FROM public.books
  WHERE deleted_at IS NULL
    AND public.normalize_book_isbn(isbn) IS NOT NULL
),
dupes AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE public.books b
SET
  deleted_at = NOW(),
  updated_at = NOW(),
  metadata = jsonb_set(
    COALESCE(b.metadata, '{}'::jsonb),
    '{deduped_into}',
    to_jsonb(d.keep_id::TEXT),
    true
  )
FROM dupes d
WHERE b.id = d.id;

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY user_id, public.normalize_book_text(title), public.normalize_book_text(author)
      ORDER BY
        COALESCE(current_page, 0) DESC,
        CASE WHEN cover_url IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN pages IS NOT NULL THEN 0 ELSE 1 END,
        created_at ASC NULLS LAST,
        id ASC
    ) AS keep_id
  FROM public.books
  WHERE deleted_at IS NULL
    AND public.normalize_book_isbn(isbn) IS NULL
    AND public.normalize_book_text(title) <> ''
),
dupes AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE public.books b
SET
  deleted_at = NOW(),
  updated_at = NOW(),
  metadata = jsonb_set(
    COALESCE(b.metadata, '{}'::jsonb),
    '{deduped_into}',
    to_jsonb(d.keep_id::TEXT),
    true
  )
FROM dupes d
WHERE b.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_books_active_user_isbn
ON public.books (user_id, public.normalize_book_isbn(isbn))
WHERE deleted_at IS NULL
  AND public.normalize_book_isbn(isbn) IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_books_active_user_title_author_no_isbn
ON public.books (
  user_id,
  public.normalize_book_text(title),
  public.normalize_book_text(author)
)
WHERE deleted_at IS NULL
  AND public.normalize_book_isbn(isbn) IS NULL
  AND public.normalize_book_text(title) <> '';

CREATE INDEX IF NOT EXISTS idx_books_user_source
ON public.books (user_id, source_provider, source_id)
WHERE source_provider IS NOT NULL
  AND source_id IS NOT NULL;

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
