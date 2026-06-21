-- Operational controls and low-volume release telemetry for the reading core.

CREATE TABLE IF NOT EXISTS public.app_feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_feature_flags (key, enabled)
VALUES ('social', TRUE)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_feature_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_feature_flags FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.app_feature_flags TO service_role;

DROP POLICY IF EXISTS "Service role manages feature flags"
  ON public.app_feature_flags;
CREATE POLICY "Service role manages feature flags"
ON public.app_feature_flags
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);

CREATE TABLE IF NOT EXISTS public.core_telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL CHECK (
    event_name IN (
      'book_search_succeeded',
      'book_search_failed',
      'book_search_cache_hit',
      'barcode_scan_succeeded',
      'barcode_scan_failed',
      'sync_succeeded',
      'sync_failed',
      'import_previewed',
      'import_completed',
      'import_failed',
      'duplicate_prevented'
    )
  ),
  platform TEXT NOT NULL DEFAULT 'web',
  app_version TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_core_telemetry_event_created
  ON public.core_telemetry_events(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_core_telemetry_user_created
  ON public.core_telemetry_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.core_telemetry_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.core_telemetry_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.core_telemetry_events TO service_role;

DROP POLICY IF EXISTS "Service role manages core telemetry"
  ON public.core_telemetry_events;
CREATE POLICY "Service role manages core telemetry"
ON public.core_telemetry_events
FOR ALL
TO service_role
USING (TRUE)
WITH CHECK (TRUE);
