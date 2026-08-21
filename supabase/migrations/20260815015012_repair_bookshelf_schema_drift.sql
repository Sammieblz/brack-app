-- Repair the bookshelf migration after its backdated version was recorded in
-- migration history without the corresponding schema objects being present.
-- Keep this migration idempotent so environments that did execute the original
-- migration retain their existing positions and API behavior.

ALTER TABLE public.books
ADD COLUMN IF NOT EXISTS shelf_position INTEGER;

WITH current_maximums AS (
  SELECT
    user_id,
    COALESCE(MAX(shelf_position), 0) AS maximum_position
  FROM public.books
  WHERE deleted_at IS NULL
  GROUP BY user_id
),
ranked_missing_positions AS (
  SELECT
    book.id,
    (
      COALESCE(current_maximums.maximum_position, 0)
      + ROW_NUMBER() OVER (
        PARTITION BY book.user_id
        ORDER BY
          book.updated_at DESC NULLS LAST,
          book.created_at DESC NULLS LAST,
          book.id
      )
    )::INTEGER AS next_position
  FROM public.books AS book
  LEFT JOIN current_maximums
    ON current_maximums.user_id = book.user_id
  WHERE book.deleted_at IS NULL
    AND book.shelf_position IS NULL
)
UPDATE public.books AS book
SET shelf_position = ranked_missing_positions.next_position
FROM ranked_missing_positions
WHERE book.id = ranked_missing_positions.id;

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
SET search_path = public, pg_temp
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
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
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
  LEFT JOIN public.books AS book
    ON book.id = requested.book_id
    AND book.user_id = p_user_id
    AND book.deleted_at IS NULL
  WHERE book.id IS NULL;

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
    UPDATE public.books AS book
    SET
      shelf_position = ordered.position,
      updated_at = v_now
    FROM ordered
    WHERE book.id = ordered.book_id
      AND book.user_id = p_user_id
      AND book.deleted_at IS NULL
    RETURNING book.id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  WITH omitted AS (
    SELECT
      book.id,
      (
        v_updated_count
        + ROW_NUMBER() OVER (
          ORDER BY
            book.shelf_position ASC NULLS LAST,
            book.updated_at DESC NULLS LAST,
            book.created_at DESC NULLS LAST,
            book.id
        )
      )::INTEGER AS position
    FROM public.books AS book
    WHERE book.user_id = p_user_id
      AND book.deleted_at IS NULL
      AND NOT (book.id = ANY(v_book_ids))
  )
  UPDATE public.books AS book
  SET
    shelf_position = omitted.position,
    updated_at = CASE
      WHEN book.shelf_position IS DISTINCT FROM omitted.position THEN v_now
      ELSE book.updated_at
    END
  FROM omitted
  WHERE book.id = omitted.id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', book.id,
        'shelf_position', book.shelf_position,
        'updated_at', book.updated_at
      )
      ORDER BY
        book.shelf_position ASC NULLS LAST,
        book.updated_at DESC NULLS LAST,
        book.created_at DESC NULLS LAST
    ),
    '[]'::JSONB
  )
  INTO v_books
  FROM public.books AS book
  WHERE book.user_id = p_user_id
    AND book.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'books', v_books
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_library_shelf(UUID, UUID[])
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reorder_library_shelf(UUID, UUID[])
TO authenticated;

COMMENT ON FUNCTION public.reorder_library_shelf(UUID, UUID[]) IS
  'Atomically reorders the authenticated reader library shelf.';

-- Preserve the latest UUID-collision repair and series behavior while adding
-- the missing shelf assignment to the current public wrapper. The private
-- add_library_book_without_series helper remains service-role-only.
CREATE OR REPLACE FUNCTION public.add_library_book(
  p_user_id UUID,
  p_book JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_book public.books;
  v_book_id UUID;
  v_requested_position INTEGER := NULLIF(p_book->>'shelf_position', '')::INTEGER;
BEGIN
  v_result := public.add_library_book_without_series(p_user_id, p_book);
  v_book_id := NULLIF(v_result->>'book_id', '')::UUID;

  IF COALESCE(v_result->>'code', '') = 'book_exists'
    AND v_book_id IS NULL THEN
    v_result := public.add_library_book_without_series(
      p_user_id,
      p_book - 'id'
    );
    v_book_id := NULLIF(v_result->>'book_id', '')::UUID;
  END IF;

  IF COALESCE((v_result->>'success')::BOOLEAN, false)
    AND v_book_id IS NOT NULL
    AND COALESCE(v_result->>'action', '') IN ('created', 'restored') THEN
    UPDATE public.books AS target
    SET
      series_name = NULLIF(trim(p_book->>'series_name'), ''),
      series_position = NULLIF(p_book->>'series_position', '')::NUMERIC,
      series_total = NULLIF(p_book->>'series_total', '')::INTEGER,
      shelf_position = COALESCE(
        v_requested_position,
        target.shelf_position,
        (
          SELECT COALESCE(MAX(candidate.shelf_position), 0) + 1
          FROM public.books AS candidate
          WHERE candidate.user_id = p_user_id
            AND candidate.id <> v_book_id
            AND candidate.deleted_at IS NULL
        )
      ),
      updated_at = NOW()
    WHERE target.id = v_book_id
      AND target.user_id = p_user_id
    RETURNING target.* INTO v_book;

    IF v_book.id IS NOT NULL THEN
      v_result := jsonb_set(v_result, '{book}', to_jsonb(v_book), true);
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.add_library_book(UUID, JSONB) IS
  'Adds, restores, or resolves a canonical library book, repairs stale client UUID collisions, and assigns its shelf position.';

REVOKE ALL ON FUNCTION public.add_library_book(UUID, JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_library_book(UUID, JSONB)
TO service_role;

REVOKE ALL ON FUNCTION public.add_library_book_without_series(UUID, JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_library_book_without_series(UUID, JSONB)
TO service_role;

-- Ask PostgREST to expose the repaired column immediately after commit.
NOTIFY pgrst, 'reload schema';
