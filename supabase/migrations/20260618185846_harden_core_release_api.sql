-- Keep release-core persistence behind Edge Functions and make list RPCs
-- execute with the caller's privileges so RLS remains authoritative.

REVOKE ALL ON TABLE public.reading_import_jobs FROM anon, authenticated;
GRANT ALL ON TABLE public.reading_import_jobs TO service_role;

DROP POLICY IF EXISTS "Service role manages book metadata cache"
  ON public.book_metadata_cache;
CREATE POLICY "Service role manages book metadata cache"
ON public.book_metadata_cache
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

ALTER FUNCTION public.reorder_book_list_items(UUID, UUID, UUID[], BIGINT)
  SECURITY INVOKER;
ALTER FUNCTION public.delete_book_list_transaction(UUID, UUID)
  SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.reorder_book_list_items(UUID, UUID, UUID[], BIGINT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_book_list_transaction(UUID, UUID)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.reorder_book_list_items(UUID, UUID, UUID[], BIGINT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_book_list_transaction(UUID, UUID)
  TO authenticated, service_role;
