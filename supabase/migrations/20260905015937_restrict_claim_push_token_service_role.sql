-- Hosted Supabase projects grant service_role explicit function privileges by
-- default. claim_push_token derives its owner exclusively from auth.uid(), so
-- it is an authenticated client boundary rather than an internal service RPC.
-- Keep the hosted ACL aligned with the clean local replay and the protected
-- application-function contract.

REVOKE ALL ON FUNCTION public.claim_push_token(TEXT, TEXT)
  FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.claim_push_token(TEXT, TEXT)
  TO authenticated;
