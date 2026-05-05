-- Tighten derived analytics snapshot writes.
--
-- The table is private owner-readable data, but writes should happen only
-- through trusted backend paths. The original policies allowed any role to
-- insert/update because their checks were `true`.

DROP POLICY IF EXISTS "Service role can insert analytics snapshots"
ON public.analytics_snapshots;

DROP POLICY IF EXISTS "Service role can update analytics snapshots"
ON public.analytics_snapshots;

REVOKE EXECUTE ON FUNCTION public.compute_daily_analytics(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.compute_daily_analytics(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_daily_analytics(uuid, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.compute_daily_analytics(uuid, date) TO service_role;
