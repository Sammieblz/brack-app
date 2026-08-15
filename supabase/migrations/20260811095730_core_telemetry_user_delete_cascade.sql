-- Journey telemetry is authenticated at ingestion and therefore keeps a
-- non-null user reference. Delete the corresponding telemetry when an auth
-- user is removed so the FK action cannot conflict with that invariant and no
-- user-linked telemetry survives account deletion.

ALTER TABLE public.core_telemetry_events
DROP CONSTRAINT IF EXISTS core_telemetry_events_user_id_fkey;

ALTER TABLE public.core_telemetry_events
ADD CONSTRAINT core_telemetry_events_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE
NOT VALID;

ALTER TABLE public.core_telemetry_events
VALIDATE CONSTRAINT core_telemetry_events_user_id_fkey;

COMMENT ON CONSTRAINT core_telemetry_events_user_id_fkey
ON public.core_telemetry_events IS
  'Delete user-linked release telemetry when the owning auth user is deleted.';
