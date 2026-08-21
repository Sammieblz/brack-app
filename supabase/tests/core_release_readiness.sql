BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(36);

SELECT has_column('public', 'book_lists', 'deleted_at', 'book lists have tombstones');
SELECT has_column('public', 'book_lists', 'order_version', 'book lists have order versions');
SELECT has_column('public', 'book_list_items', 'user_id', 'list items carry owner identity');
SELECT has_column('public', 'book_list_items', 'updated_at', 'list items are syncable');
SELECT has_column('public', 'book_list_items', 'deleted_at', 'list items have tombstones');
SELECT has_index(
  'public',
  'book_list_items',
  'idx_book_list_items_active_unique',
  'active list membership is duplicate-protected'
);
SELECT has_function(
  'public',
  'reorder_book_list_items',
  ARRAY['uuid', 'uuid', 'uuid[]', 'bigint'],
  'list reorder transaction exists'
);
SELECT has_function(
  'public',
  'delete_book_list_transaction',
  ARRAY['uuid', 'uuid'],
  'list delete transaction exists'
);
SELECT has_table('public', 'book_metadata_cache', 'provider metadata cache exists');
SELECT has_table('public', 'reading_import_jobs', 'resumable import jobs exist');
SELECT has_table('public', 'app_feature_flags', 'remote feature flags exist');
SELECT has_table('public', 'core_telemetry_events', 'core telemetry table exists');
SELECT has_function(
  'public',
  'validate_reading_session_row',
  ARRAY[]::TEXT[],
  'reading session row validation trigger function exists'
);
SELECT has_function(
  'public',
  'create_book_activity',
  ARRAY[]::TEXT[],
  'social book activity trigger function is migration-managed'
);
SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgname IN (
        'create_badge_activity_trigger',
        'create_book_activity_trigger',
        'create_follow_activity_trigger',
        'create_list_activity_trigger',
        'create_review_activity_trigger'
      )
  ),
  5,
  'all legacy social activity triggers are migration-managed'
);
SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.book_lists'::regclass
  ),
  'book list RLS is active'
);
SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.reading_import_jobs'::regclass
  ),
  'reading import RLS is active'
);

SELECT is(
  public.normalize_book_isbn('0-306-40615-2'),
  '9780306406157',
  'ISBN-10 values canonicalize to ISBN-13'
);

SELECT is(
  public.normalize_book_isbn('978-0-306-40615-7'),
  '9780306406157',
  'valid ISBN-13 values remain canonical'
);

SELECT is(
  public.normalize_book_isbn('4006381333931'),
  NULL::TEXT,
  'non-ISBN EAN-13 values are rejected'
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
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'timer-guard@example.com',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Timer Guard"}',
  now(),
  now()
);

INSERT INTO public.profiles(id, display_name)
VALUES ('20000000-0000-0000-0000-000000000001', 'Timer Guard')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.books(id, user_id, title, author, isbn, pages, status)
VALUES (
  '20000000-0000-0000-0000-000000000101',
  '20000000-0000-0000-0000-000000000001',
  'Timer Test Book',
  'Brack',
  '0-306-40615-2',
  120,
  'reading'
);

SELECT is(
  public.add_library_book(
    '20000000-0000-0000-0000-000000000001',
    '{"title":"Same ISBN, different metadata","isbn":"9780306406157"}'::JSONB
  )->>'code',
  'book_exists',
  'library add rejects an equivalent ISBN-13 when ISBN-10 already exists'
);

INSERT INTO public.books(id, user_id, title, author, status)
SELECT
  (
    '20000000-0000-0001-0000-'
    || lpad(sequence_number::TEXT, 12, '0')
  )::UUID,
  '20000000-0000-0000-0000-000000000001',
  'Badge Baseline Book ' || sequence_number,
  'Brack',
  'to_read'
FROM generate_series(1, 8) AS sequence_number;

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.user_badges user_badge
    JOIN public.badges badge ON badge.id = user_badge.badge_id
    WHERE user_badge.user_id = '20000000-0000-0000-0000-000000000001'
      AND badge.code = 'shelf-starter'
  ),
  0,
  'nine current-install books do not yet award the ten-book badge'
);

INSERT INTO public.books(
  id,
  user_id,
  title,
  author,
  status,
  metadata
)
VALUES (
  '20000000-0000-0001-0000-000000000009',
  '20000000-0000-0000-0000-000000000001',
  'Imported Tenth Book',
  'Brack',
  'to_read',
  '{"import_source":"brack"}'::JSONB
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.user_badges user_badge
    JOIN public.badges badge ON badge.id = user_badge.badge_id
    WHERE user_badge.user_id = '20000000-0000-0000-0000-000000000001'
      AND badge.code = 'shelf-starter'
  ),
  0,
  'an imported tenth book does not award a current-install badge'
);

SELECT lives_ok(
  $$
    INSERT INTO public.reading_sessions(user_id, book_id, start_time, end_time, duration)
    VALUES (
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000101',
      now() - INTERVAL '30 minutes',
      now(),
      30
    )
  $$,
  'a realistic timer session is accepted'
);

SELECT throws_ok(
  $$
    INSERT INTO public.reading_sessions(user_id, book_id, start_time, end_time, duration)
    VALUES (
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000101',
      now() - INTERVAL '721 minutes',
      now(),
      721
    )
  $$,
  'P0001',
  'Reading sessions cannot exceed 12 hours',
  'over-limit timer sessions are rejected'
);

SELECT throws_ok(
  $$
    INSERT INTO public.reading_sessions(user_id, book_id, start_time, end_time, duration)
    VALUES (
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000101',
      now() - INTERVAL '5 minutes',
      now(),
      60
    )
  $$,
  'P0001',
  'Reading session duration does not match its time range',
  'timer duration must match the saved time range'
);

SELECT lives_ok(
  $$
    INSERT INTO public.progress_logs(
      id,
      user_id,
      book_id,
      page_number,
      log_type,
      logged_at
    )
    VALUES (
      '20000000-0000-0000-0000-000000000201',
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000101',
      80,
      'import',
      now() - INTERVAL '1 day'
    )
  $$,
  'import progress is accepted as historical activity'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.gamification_ledger
    WHERE source_type = 'progress_log'
      AND source_id = '20000000-0000-0000-0000-000000000201'
  ),
  0,
  'import progress does not award new gamification credit'
);

SELECT lives_ok(
  $$
    INSERT INTO public.reading_sessions(
      id,
      user_id,
      book_id,
      start_time,
      end_time,
      duration,
      client_session_id
    )
    VALUES (
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000101',
      now() - INTERVAL '1 day 30 minutes',
      now() - INTERVAL '1 day',
      30,
      'import:20000000-0000-0000-0000-000000000301'
    )
  $$,
  'import sessions are accepted as historical activity'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.gamification_ledger
    WHERE source_type = 'reading_session'
      AND source_id = '20000000-0000-0000-0000-000000000301'
  ),
  0,
  'import sessions do not award new gamification credit'
);

SELECT lives_ok(
  $$
    UPDATE public.books
    SET
      status = 'completed',
      metadata = jsonb_build_object('import_source', 'brack')
    WHERE id = '20000000-0000-0000-0000-000000000101'
  $$,
  'an imported completion can restore book state'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.gamification_ledger
    WHERE event_key = 'book-completed:20000000-0000-0000-0000-000000000101'
  ),
  0,
  'an imported completion does not award new gamification credit'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.social_activities
    WHERE user_id = '20000000-0000-0000-0000-000000000001'
      AND book_id = '20000000-0000-0000-0000-000000000101'
      AND activity_type = 'book_completed'
  ),
  0,
  'an imported completion does not publish current feed activity'
);

SELECT lives_ok(
  $$
    UPDATE public.books
    SET status = 'reading'
    WHERE id = '20000000-0000-0000-0000-000000000101';

    UPDATE public.books
    SET status = 'completed'
    WHERE id = '20000000-0000-0000-0000-000000000101'
  $$,
  'an imported book can later be completed as current reading'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.gamification_ledger
    WHERE event_key = 'book-completed:20000000-0000-0000-0000-000000000101'
  ),
  1,
  'a later genuine completion awards gamification credit'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.social_activities
    WHERE user_id = '20000000-0000-0000-0000-000000000001'
      AND book_id = '20000000-0000-0000-0000-000000000101'
      AND activity_type = 'book_completed'
  ),
  1,
  'a later genuine completion publishes feed activity'
);

SELECT * FROM finish();
ROLLBACK;
