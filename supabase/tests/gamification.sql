BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(28);

SELECT has_table('public', 'gamification_accounts', 'gamification accounts exist');
SELECT has_table('public', 'gamification_ledger', 'Ink ledger exists');
SELECT has_table('public', 'user_quest_assignments', 'quest assignments exist');
SELECT has_table('public', 'reader_leagues', 'reader leagues exist');
SELECT has_table('public', 'user_notifications', 'durable notifications exist');
SELECT has_index(
  'public',
  'gamification_ledger',
  'gamification_ledger_user_event_key',
  'ledger event keys are unique per user'
);
SELECT has_function(
  'public',
  'apply_gamification_event',
  ARRAY['uuid', 'text', 'text', 'text', 'text', 'jsonb', 'timestamp with time zone'],
  'server reward function exists'
);
SELECT has_function(
  'public',
  'ensure_user_quests',
  ARRAY['uuid', 'timestamp with time zone', 'boolean'],
  'quest generation function exists'
);
SELECT has_function(
  'public',
  'finalize_gamification_week',
  ARRAY['uuid'],
  'weekly finalization function exists'
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
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ink-one@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ink One"}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ink-two@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ink Two"}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ink-three@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ink Three"}',
    now(),
    now()
  );

SELECT lives_ok(
  $$
    SELECT public.apply_gamification_event(
      '10000000-0000-0000-0000-000000000001',
      'book_added',
      'test-book-1',
      'book',
      'book-1',
      '{}'::jsonb,
      now()
    )
  $$,
  'a valid reward event applies'
);

SELECT lives_ok(
  $$
    SELECT public.apply_gamification_event(
      '10000000-0000-0000-0000-000000000001',
      'book_added',
      'test-book-1',
      'book',
      'book-1',
      '{}'::jsonb,
      now()
    )
  $$,
  'an idempotent retry is accepted'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.gamification_ledger
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
      AND event_key = 'test-book-1'
  ),
  1,
  'an event key produces one ledger row'
);

SELECT is(
  (
    SELECT lifetime_ink::INTEGER
    FROM public.gamification_accounts
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
  ),
  5,
  'idempotent retries do not duplicate Ink'
);

SELECT public.apply_gamification_event(
  '10000000-0000-0000-0000-000000000001',
  'book_added',
  'test-book-2',
  'book',
  'book-2',
  '{}'::jsonb,
  now()
);
SELECT public.apply_gamification_event(
  '10000000-0000-0000-0000-000000000001',
  'book_added',
  'test-book-3',
  'book',
  'book-3',
  '{}'::jsonb,
  now()
);
SELECT public.apply_gamification_event(
  '10000000-0000-0000-0000-000000000001',
  'book_added',
  'test-book-4',
  'book',
  'book-4',
  '{}'::jsonb,
  now()
);

SELECT is(
  (
    SELECT lifetime_ink::INTEGER
    FROM public.gamification_accounts
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
  ),
  15,
  'book-add Ink is capped at three rewards per local day'
);

SELECT public.apply_gamification_event(
  '10000000-0000-0000-0000-000000000002',
  'page_progress',
  'competitive-' || value,
  'progress_log',
  value::TEXT,
  '{"pages_read":100}'::jsonb,
  now()
)
FROM generate_series(1, 8) value;

SELECT is(
  (
    SELECT competitive_ink
    FROM public.gamification_daily_scores
    WHERE user_id = '10000000-0000-0000-0000-000000000002'
      AND score_date = CURRENT_DATE
  ),
  150,
  'competitive reading Ink is capped at 150 per local day'
);

SELECT is(
  (
    SELECT lifetime_ink::INTEGER
    FROM public.gamification_accounts
    WHERE user_id = '10000000-0000-0000-0000-000000000002'
  ),
  160,
  'the competitive cap does not reduce lifetime Ink'
);

SELECT public.ensure_user_quests(
  '10000000-0000-0000-0000-000000000001',
  now(),
  true
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.user_quest_assignments
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
      AND cadence = 'daily'
      AND assignment_date = CURRENT_DATE
  ),
  3,
  'three daily quests are generated'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.user_quest_assignments
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
      AND cadence = 'daily'
      AND assignment_date = CURRENT_DATE + 1
  ),
  3,
  'tomorrow daily quests are prefetched'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.user_quest_assignments
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
      AND cadence = 'weekly'
      AND assignment_date = date_trunc('week', CURRENT_DATE::TIMESTAMP)::DATE
  ),
  3,
  'three weekly quests are generated'
);

SELECT ok(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.user_quest_assignments
    WHERE user_id = '10000000-0000-0000-0000-000000000001'
      AND cadence = 'weekly'
      AND assignment_date = date_trunc('week', CURRENT_DATE::TIMESTAMP)::DATE
      AND reward_gold_leaves > 0
  ) <= 1,
  'a weekly quest set contains at most one rare quest'
);

SELECT public.advance_user_quests(
  '10000000-0000-0000-0000-000000000001',
  'reading_minutes',
  10,
  'same-reading-source',
  now()
);
SELECT public.advance_user_quests(
  '10000000-0000-0000-0000-000000000001',
  'reading_minutes',
  10,
  'same-reading-source',
  now()
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.user_quest_assignments assignments
    JOIN public.quest_templates templates ON templates.id = assignments.template_id
    WHERE assignments.user_id = '10000000-0000-0000-0000-000000000001'
      AND templates.metric = 'reading_minutes'
      AND assignments.progress_value > 10
  ),
  'quest progress counts one source event once'
);

SELECT public.update_gamification_settings(
  '10000000-0000-0000-0000-000000000001',
  true,
  true,
  'America/New_York'
);

SELECT is(
  (
    SELECT leaderboard_eligible_from
    FROM public.profiles
    WHERE id = '10000000-0000-0000-0000-000000000001'
  ),
  date_trunc('week', CURRENT_DATE::TIMESTAMP)::DATE + 7,
  'leaderboard opt-in begins next weekly cycle'
);

SELECT public.assign_reader_leagues(
  (public.ensure_gamification_week(CURRENT_DATE)).id
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.reader_league_members membership
    JOIN public.reader_leagues league ON league.id = membership.league_id
    WHERE membership.user_id = '10000000-0000-0000-0000-000000000001'
      AND league.week_id = (public.ensure_gamification_week(CURRENT_DATE)).id
  ),
  'a newly opted-in user is not assigned to the current league'
);

UPDATE public.profiles
SET
  leaderboard_opt_in = true,
  leaderboard_eligible_from = date_trunc('week', CURRENT_DATE::TIMESTAMP)::DATE
WHERE id IN (
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

SELECT ok(
  public.assign_reader_leagues((public.ensure_gamification_week(CURRENT_DATE)).id) >= 2,
  'eligible users are assigned to Reader Leagues'
);

INSERT INTO public.user_blocks(blocker_id, blocked_id)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

INSERT INTO public.gamification_weekly_scores(
  week_id,
  user_id,
  competitive_ink,
  score_attained_at
)
VALUES
  (
    (public.ensure_gamification_week(CURRENT_DATE)).id,
    '10000000-0000-0000-0000-000000000002',
    50,
    now()
  ),
  (
    (public.ensure_gamification_week(CURRENT_DATE)).id,
    '10000000-0000-0000-0000-000000000003',
    60,
    now()
  )
ON CONFLICT (week_id, user_id) DO UPDATE
SET competitive_ink = EXCLUDED.competitive_ink;

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.get_reader_leaderboard(
        '10000000-0000-0000-0000-000000000002',
        'global',
        (public.ensure_gamification_week(CURRENT_DATE)).id,
        100
      )->'entries'
    ) AS leaderboard_entry
    WHERE leaderboard_entry->>'user_id'
      = '10000000-0000-0000-0000-000000000003'
  ),
  'blocked users are excluded from leaderboard results'
);

SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.gamification_ledger'::regclass
  ),
  'gamification ledger RLS is active'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.apply_gamification_event(uuid,text,text,text,text,jsonb,timestamp with time zone)',
    'EXECUTE'
  ),
  'authenticated clients cannot award their own Ink'
);

SELECT ok(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.quest_templates
    WHERE cadence = 'weekly'
      AND gold_leaves_reward > 0
  ) >= 1,
  'rare weekly Gold Leaf quests are configured'
);

SELECT * FROM finish();
ROLLBACK;
