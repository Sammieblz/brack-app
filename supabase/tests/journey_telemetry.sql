BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(10);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.core_telemetry_events'::REGCLASS
      AND conname = 'core_telemetry_events_event_name_check'
      AND contype = 'c'
      AND convalidated
  ),
  'the telemetry event allowlist constraint is present and validated'
);

INSERT INTO auth.users(
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'journey-telemetry@example.com',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
);

SELECT lives_ok(
  $$
    INSERT INTO public.core_telemetry_events(id, user_id, event_name, metadata)
    VALUES (
      '50000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      'journey_opened',
      '{"source":"dashboard_hud","freshness":"live"}'::JSONB
    )
  $$,
  'authenticated Journey opens are accepted'
);

SELECT lives_ok(
  $$
    INSERT INTO public.core_telemetry_events(id, user_id, event_name, metadata)
    VALUES (
      '50000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000001',
      'journey_tab_viewed',
      '{"source":"journey","destination_tab":"quests"}'::JSONB
    )
  $$,
  'authenticated Journey tab views are accepted'
);

SELECT lives_ok(
  $$
    INSERT INTO public.core_telemetry_events(id, user_id, event_name, metadata)
    VALUES (
      '50000000-0000-0000-0000-000000000003',
      '40000000-0000-0000-0000-000000000001',
      'daily_focus_started',
      '{"source":"dashboard_daily_focus","quest_metric":"reading_minutes"}'::JSONB
    )
  $$,
  'authenticated Daily Focus starts are accepted'
);

SELECT lives_ok(
  $$
    INSERT INTO public.core_telemetry_events(event_name)
    VALUES ('book_search_succeeded')
  $$,
  'existing anonymous telemetry remains accepted'
);

SELECT throws_ok(
  $$
    INSERT INTO public.core_telemetry_events(event_name)
    VALUES ('journey_opened')
  $$,
  '23514',
  NULL,
  'Journey telemetry cannot be stored without an authenticated user identity'
);

SELECT throws_ok(
  $$
    INSERT INTO public.core_telemetry_events(event_name)
    VALUES ('unsupported_event')
  $$,
  '23514',
  NULL,
  'events outside the telemetry allowlist remain rejected'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.core_telemetry_events', 'INSERT'),
  'authenticated clients cannot insert telemetry directly'
);

SELECT lives_ok(
  $$
    DELETE FROM auth.users
    WHERE id = '40000000-0000-0000-0000-000000000001'
  $$,
  'deleting an auth user with Journey telemetry succeeds'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.core_telemetry_events
    WHERE id IN (
      '50000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000002',
      '50000000-0000-0000-0000-000000000003'
    )
  ),
  0,
  'deleting an auth user removes their Journey telemetry'
);

SELECT * FROM finish();
ROLLBACK;
