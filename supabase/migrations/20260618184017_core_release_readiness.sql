-- Brack core release readiness:
-- durable list sync, transactional ordering, provider metadata cache, and import jobs.

ALTER TABLE public.book_lists
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS order_version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.book_list_items
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE public.book_list_items AS item
SET user_id = list.user_id
FROM public.book_lists AS list
WHERE list.id = item.list_id
  AND item.user_id IS NULL;

ALTER TABLE public.book_list_items
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.book_list_items
  DROP CONSTRAINT IF EXISTS book_list_items_list_id_book_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_book_list_items_active_unique
  ON public.book_list_items(list_id, book_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_book_lists_sync
  ON public.book_lists(user_id, updated_at, id);

CREATE INDEX IF NOT EXISTS idx_book_lists_active
  ON public.book_lists(user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_book_list_items_sync
  ON public.book_list_items(user_id, updated_at, id);

CREATE INDEX IF NOT EXISTS idx_book_list_items_active_order
  ON public.book_list_items(list_id, position, id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_book_list_items_updated_at ON public.book_list_items;
CREATE TRIGGER update_book_list_items_updated_at
BEFORE UPDATE ON public.book_list_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can manage items in their own lists" ON public.book_list_items;
CREATE POLICY "Users can manage items in their own lists"
ON public.book_list_items
FOR ALL
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.book_lists
    WHERE book_lists.id = book_list_items.list_id
      AND book_lists.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.book_lists
    WHERE book_lists.id = book_list_items.list_id
      AND book_lists.user_id = auth.uid()
      AND book_lists.deleted_at IS NULL
  )
);

CREATE OR REPLACE FUNCTION public.reorder_book_list_items(
  p_user_id UUID,
  p_list_id UUID,
  p_ordered_book_ids UUID[],
  p_expected_version BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list public.book_lists%ROWTYPE;
  v_active_count INTEGER;
  v_distinct_count INTEGER;
  v_next_version BIGINT;
  v_items JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT *
  INTO v_list
  FROM public.book_lists
  WHERE id = p_list_id
    AND user_id = p_user_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book list not found or access denied';
  END IF;

  IF p_expected_version IS NOT NULL AND v_list.order_version <> p_expected_version THEN
    RAISE EXCEPTION 'Book list order changed on another device';
  END IF;

  SELECT COUNT(*)
  INTO v_active_count
  FROM public.book_list_items
  WHERE list_id = p_list_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  SELECT COUNT(DISTINCT value)
  INTO v_distinct_count
  FROM unnest(COALESCE(p_ordered_book_ids, ARRAY[]::UUID[])) AS value;

  IF cardinality(COALESCE(p_ordered_book_ids, ARRAY[]::UUID[])) <> v_active_count
     OR v_distinct_count <> v_active_count
     OR EXISTS (
       SELECT 1
       FROM unnest(COALESCE(p_ordered_book_ids, ARRAY[]::UUID[])) AS submitted(book_id)
       LEFT JOIN public.book_list_items AS item
         ON item.list_id = p_list_id
        AND item.user_id = p_user_id
        AND item.book_id = submitted.book_id
        AND item.deleted_at IS NULL
       WHERE item.id IS NULL
     ) THEN
    RAISE EXCEPTION 'Submitted order must contain every active list book exactly once';
  END IF;

  UPDATE public.book_list_items AS item
  SET
    position = submitted.ordinality - 1,
    updated_at = NOW()
  FROM unnest(COALESCE(p_ordered_book_ids, ARRAY[]::UUID[]))
    WITH ORDINALITY AS submitted(book_id, ordinality)
  WHERE item.list_id = p_list_id
    AND item.user_id = p_user_id
    AND item.book_id = submitted.book_id
    AND item.deleted_at IS NULL;

  v_next_version := v_list.order_version + 1;

  UPDATE public.book_lists
  SET
    order_version = v_next_version,
    updated_at = NOW()
  WHERE id = p_list_id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(item) ORDER BY item.position, item.id),
    '[]'::JSONB
  )
  INTO v_items
  FROM public.book_list_items AS item
  WHERE item.list_id = p_list_id
    AND item.user_id = p_user_id
    AND item.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'success', TRUE,
    'list_id', p_list_id,
    'order_version', v_next_version,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_book_list_items(UUID, UUID, UUID[], BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_book_list_items(UUID, UUID, UUID[], BIGINT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_book_list_transaction(
  p_user_id UUID,
  p_list_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_at TIMESTAMPTZ := NOW();
  v_list public.book_lists%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.book_lists
  SET
    deleted_at = v_deleted_at,
    updated_at = v_deleted_at
  WHERE id = p_list_id
    AND user_id = p_user_id
  RETURNING * INTO v_list;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Book list not found or access denied';
  END IF;

  UPDATE public.book_list_items
  SET
    deleted_at = v_deleted_at,
    updated_at = v_deleted_at
  WHERE list_id = p_list_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'success', TRUE,
    'list', to_jsonb(v_list),
    'deleted_at', v_deleted_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_book_list_transaction(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_book_list_transaction(UUID, UUID)
  TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.book_metadata_cache (
  cache_key TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  isbn TEXT,
  provider TEXT NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_book_metadata_cache_expiry
  ON public.book_metadata_cache(expires_at);

ALTER TABLE public.book_metadata_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.book_metadata_cache FROM anon, authenticated;
GRANT ALL ON TABLE public.book_metadata_cache TO service_role;

CREATE TABLE IF NOT EXISTS public.reading_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_format TEXT NOT NULL CHECK (
    source_format IN ('brack', 'json', 'csv', 'goodreads_csv')
  ),
  status TEXT NOT NULL DEFAULT 'previewed' CHECK (
    status IN ('previewed', 'processing', 'completed', 'failed')
  ),
  source_hash TEXT NOT NULL,
  preview JSONB NOT NULL DEFAULT '{}'::JSONB,
  result JSONB,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  total_items INTEGER NOT NULL DEFAULT 0 CHECK (total_items >= 0),
  processed_items INTEGER NOT NULL DEFAULT 0 CHECK (processed_items >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, source_hash)
);

CREATE INDEX IF NOT EXISTS idx_reading_import_jobs_user_status
  ON public.reading_import_jobs(user_id, status, updated_at DESC);

ALTER TABLE public.reading_import_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own reading imports"
  ON public.reading_import_jobs;
CREATE POLICY "Users can manage their own reading imports"
ON public.reading_import_jobs
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_reading_import_jobs_updated_at
  ON public.reading_import_jobs;
CREATE TRIGGER update_reading_import_jobs_updated_at
BEFORE UPDATE ON public.reading_import_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
