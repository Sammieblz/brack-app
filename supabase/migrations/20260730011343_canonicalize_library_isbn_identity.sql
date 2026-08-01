-- Treat checksum-equivalent ISBN-10 and ISBN-13 values as one library identity.
-- The migration is deliberately transactional and aborts instead of silently
-- merging user data if a deployment already contains newly equivalent rows.

BEGIN;

DROP INDEX IF EXISTS public.uniq_books_active_user_isbn;
DROP INDEX IF EXISTS public.uniq_books_active_user_title_author_no_isbn;

CREATE OR REPLACE FUNCTION public.normalize_book_isbn(value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
DECLARE
  v_normalized TEXT := upper(regexp_replace(coalesce(value, ''), '[^0-9X]', '', 'g'));
  v_total INTEGER := 0;
  v_index INTEGER;
  v_check_digit INTEGER;
  v_expected_check_digit INTEGER;
  v_isbn13_body TEXT;
BEGIN
  IF v_normalized ~ '^[0-9]{13}$'
    AND left(v_normalized, 3) IN ('978', '979')
  THEN
    FOR v_index IN 1..12 LOOP
      v_total := v_total
        + substring(v_normalized FROM v_index FOR 1)::INTEGER
          * CASE WHEN v_index % 2 = 1 THEN 1 ELSE 3 END;
    END LOOP;

    v_expected_check_digit := (10 - (v_total % 10)) % 10;
    IF v_expected_check_digit = right(v_normalized, 1)::INTEGER THEN
      RETURN v_normalized;
    END IF;
    RETURN NULL;
  END IF;

  IF v_normalized ~ '^[0-9]{9}[0-9X]$' THEN
    FOR v_index IN 1..9 LOOP
      v_total := v_total
        + substring(v_normalized FROM v_index FOR 1)::INTEGER * (11 - v_index);
    END LOOP;

    v_check_digit := CASE
      WHEN right(v_normalized, 1) = 'X' THEN 10
      ELSE right(v_normalized, 1)::INTEGER
    END;

    IF (v_total + v_check_digit) % 11 <> 0 THEN
      RETURN NULL;
    END IF;

    v_isbn13_body := '978' || left(v_normalized, 9);
    v_total := 0;
    FOR v_index IN 1..12 LOOP
      v_total := v_total
        + substring(v_isbn13_body FROM v_index FOR 1)::INTEGER
          * CASE WHEN v_index % 2 = 1 THEN 1 ELSE 3 END;
    END LOOP;

    v_expected_check_digit := (10 - (v_total % 10)) % 10;
    RETURN v_isbn13_body || v_expected_check_digit::TEXT;
  END IF;

  RETURN NULL;
END;
$$;

DO $$
DECLARE
  v_isbn_conflicts INTEGER;
  v_title_conflicts INTEGER;
BEGIN
  SELECT count(*)
  INTO v_isbn_conflicts
  FROM (
    SELECT user_id, public.normalize_book_isbn(isbn)
    FROM public.books
    WHERE deleted_at IS NULL
      AND public.normalize_book_isbn(isbn) IS NOT NULL
    GROUP BY user_id, public.normalize_book_isbn(isbn)
    HAVING count(*) > 1
  ) conflicts;

  IF v_isbn_conflicts > 0 THEN
    RAISE EXCEPTION
      USING
        ERRCODE = '23505',
        MESSAGE = format(
          'Canonical ISBN migration found %s active duplicate group(s); reconcile them before retrying',
          v_isbn_conflicts
        );
  END IF;

  SELECT count(*)
  INTO v_title_conflicts
  FROM (
    SELECT
      user_id,
      public.normalize_book_text(title),
      public.normalize_book_text(author)
    FROM public.books
    WHERE deleted_at IS NULL
      AND public.normalize_book_isbn(isbn) IS NULL
      AND public.normalize_book_text(title) <> ''
    GROUP BY
      user_id,
      public.normalize_book_text(title),
      public.normalize_book_text(author)
    HAVING count(*) > 1
  ) conflicts;

  IF v_title_conflicts > 0 THEN
    RAISE EXCEPTION
      USING
        ERRCODE = '23505',
        MESSAGE = format(
          'Canonical ISBN migration found %s active title/author duplicate group(s); reconcile them before retrying',
          v_title_conflicts
        );
  END IF;
END;
$$;

CREATE UNIQUE INDEX uniq_books_active_user_isbn
ON public.books (user_id, public.normalize_book_isbn(isbn))
WHERE deleted_at IS NULL
  AND public.normalize_book_isbn(isbn) IS NOT NULL;

CREATE UNIQUE INDEX uniq_books_active_user_title_author_no_isbn
ON public.books (
  user_id,
  public.normalize_book_text(title),
  public.normalize_book_text(author)
)
WHERE deleted_at IS NULL
  AND public.normalize_book_isbn(isbn) IS NULL
  AND public.normalize_book_text(title) <> '';

COMMENT ON FUNCTION public.normalize_book_isbn(TEXT) IS
  'Returns a checksum-validated canonical ISBN-13, converting valid ISBN-10 values; invalid values return NULL.';

COMMIT;
