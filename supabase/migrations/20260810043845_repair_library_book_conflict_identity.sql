-- Repair offline book reconciliation when a stale client UUID collides with an
-- existing global books primary key, or when a concurrent identity insert wins
-- after add_library_book_without_series performs its initial lookup.
--
-- The legacy helper intentionally converts every unique_violation into a
-- `book_exists` result, but that exception result has no book_id. Replaying the
-- identity operation once without the client-provided UUID either observes the
-- canonical winner or creates/restores the user's book under a server UUID.

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
  v_result JSONB;
  v_book public.books;
  v_book_id UUID;
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
    UPDATE public.books
    SET
      series_name = NULLIF(trim(p_book->>'series_name'), ''),
      series_position = NULLIF(p_book->>'series_position', '')::NUMERIC,
      series_total = NULLIF(p_book->>'series_total', '')::INTEGER,
      updated_at = now()
    WHERE id = v_book_id
      AND user_id = p_user_id
    RETURNING * INTO v_book;

    IF v_book.id IS NOT NULL THEN
      v_result := jsonb_set(v_result, '{book}', to_jsonb(v_book), true);
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.add_library_book(UUID, JSONB) IS
  'Adds, restores, or resolves a canonical library book and repairs stale client UUID collisions with a bounded identity replay.';
