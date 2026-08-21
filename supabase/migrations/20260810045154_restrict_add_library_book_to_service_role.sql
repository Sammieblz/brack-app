-- Library writes enter through JWT-protected Edge Functions. Keep the
-- SECURITY DEFINER identity resolver out of the directly exposed RPC surface.

REVOKE ALL ON FUNCTION public.add_library_book(UUID, JSONB)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.add_library_book(UUID, JSONB)
TO service_role;
