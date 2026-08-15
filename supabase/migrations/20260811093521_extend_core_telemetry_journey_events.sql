-- Extend the protected telemetry vocabulary for the Journey redesign.
-- Add and validate the superset first so supported writes remain constrained
-- throughout the migration, then replace the original generated check name.

ALTER TABLE public.core_telemetry_events
ADD CONSTRAINT core_telemetry_events_journey_event_check
CHECK (
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
    'duplicate_prevented',
    'journey_opened',
    'journey_tab_viewed',
    'daily_focus_started'
  )
  AND (
    event_name NOT IN (
      'journey_opened',
      'journey_tab_viewed',
      'daily_focus_started'
    )
    OR user_id IS NOT NULL
  )
) NOT VALID;

ALTER TABLE public.core_telemetry_events
VALIDATE CONSTRAINT core_telemetry_events_journey_event_check;

ALTER TABLE public.core_telemetry_events
DROP CONSTRAINT IF EXISTS core_telemetry_events_event_name_check;

ALTER TABLE public.core_telemetry_events
RENAME CONSTRAINT core_telemetry_events_journey_event_check
TO core_telemetry_events_event_name_check;

COMMENT ON CONSTRAINT core_telemetry_events_event_name_check
ON public.core_telemetry_events IS
  'Allowlisted release telemetry events; Journey events require an authenticated user identity.';
