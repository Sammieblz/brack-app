-- add_library_book is SECURITY DEFINER and accepts an explicit user UUID.
-- Keep it behind an authenticated session or the service-role Edge layer;
-- PostgreSQL grants EXECUTE to PUBLIC for new functions unless revoked.

REVOKE ALL ON FUNCTION public.add_library_book(UUID, JSONB)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.add_library_book(UUID, JSONB)
TO authenticated, service_role;

-- Reassert the private helper contract for databases upgraded from older
-- migration histories.
REVOKE ALL ON FUNCTION public.add_library_book_without_series(UUID, JSONB)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.add_library_book_without_series(UUID, JSONB)
TO service_role;
