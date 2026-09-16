-- Hosted Supabase grants service_role EXECUTE on newly created functions by
-- default. These routines are internal trigger helpers and are never direct
-- service APIs, so make their intended boundary explicit in every environment.

REVOKE ALL ON FUNCTION public.lock_direct_message_user(UUID)
  FROM service_role;
REVOKE ALL ON FUNCTION public.lock_direct_message_pair(UUID, UUID)
  FROM service_role;
REVOKE ALL ON FUNCTION public.lock_direct_message_relationship_change()
  FROM service_role;
REVOKE ALL ON FUNCTION public.lock_direct_message_block_change()
  FROM service_role;
REVOKE ALL ON FUNCTION public.lock_direct_message_profile_change()
  FROM service_role;
REVOKE ALL ON FUNCTION public.enforce_direct_conversation_eligibility()
  FROM service_role;
REVOKE ALL ON FUNCTION public.enforce_direct_message_eligibility()
  FROM service_role;
REVOKE ALL ON FUNCTION public.touch_direct_message_eligibility()
  FROM service_role;
REVOKE ALL ON FUNCTION public.touch_direct_message_profile_eligibility()
  FROM service_role;
