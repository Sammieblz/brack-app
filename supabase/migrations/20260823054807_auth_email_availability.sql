-- Supabase Auth intentionally obfuscates duplicate sign-up responses. This
-- backend-only predicate lets the rate-limited registration Edge Function
-- enforce Brack's explicit one-email/one-reader product policy before Auth is
-- asked to create or resend anything.
CREATE OR REPLACE FUNCTION public.auth_email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT CASE
    WHEN p_email IS NULL
      OR LENGTH(BTRIM(p_email)) = 0
      OR LENGTH(BTRIM(p_email)) > 254
    THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM auth.users AS users
      WHERE LOWER(BTRIM(users.email)) = LOWER(BTRIM(p_email))
    )
  END;
$function$;

REVOKE ALL
ON FUNCTION public.auth_email_exists(TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.auth_email_exists(TEXT)
TO service_role;

COMMENT ON FUNCTION public.auth_email_exists(TEXT) IS
  'Backend-only duplicate-email predicate for the rate-limited sign-up availability endpoint.';

NOTIFY pgrst, 'reload schema';
