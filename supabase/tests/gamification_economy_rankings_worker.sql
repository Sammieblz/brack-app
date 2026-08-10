BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(66);

-- Economy schema and callable surface.
SELECT has_table('public', 'gamification_shop_items', 'gamification shop catalog exists');
SELECT has_table('public', 'user_gamification_inventory', 'gamification inventory exists');
SELECT has_table('public', 'gamification_purchases', 'gamification purchase history exists');
SELECT has_function(
  'public',
  'get_gamification_shop',
  ARRAY['uuid'],
  'shop read function exists'
);
SELECT has_function(
  'public',
  'purchase_gamification_item',
  ARRAY['uuid', 'text', 'integer', 'text'],
  'atomic shop purchase function exists'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.gamification_shop_items
    WHERE code = 'streak_freeze'
      AND item_type = 'streak_freeze'
      AND gold_leaves_cost = 1
      AND max_inventory = 3
      AND enabled
  ),
  'the streak freeze is an enabled one-Leaf catalog item capped at three'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.get_gamification_shop(uuid)',
    'EXECUTE'
  ),
  'authenticated clients cannot bypass the shop Edge endpoint'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.purchase_gamification_item(uuid,text,integer,text)',
    'EXECUTE'
  ),
  'authenticated clients cannot call the purchase function directly'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.get_gamification_shop(uuid)',
    'EXECUTE'
  ),
  'the service role can read the shop'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.purchase_gamification_item(uuid,text,integer,text)',
    'EXECUTE'
  ),
  'the service role can make an authenticated purchase'
);

-- Isolated users for purchase, freeze, and Reader League contracts.
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
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repair-purchase@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Repair Purchase"}', now(), now()),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repair-insufficient@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Repair Insufficient"}', now(), now()),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repair-freeze-good@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Repair Freeze Good"}', now(), now()),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repair-freeze-date@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Repair Freeze Date"}', now(), now()),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repair-freeze-prior@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Repair Freeze Prior"}', now(), now()),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repair-freeze-cooldown@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Repair Freeze Cooldown"}', now(), now()),
  ('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repair-freeze-ready@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Repair Freeze Ready"}', now(), now()),
  ('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repair-freeze-empty@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Repair Freeze Empty"}', now(), now()),
  ('30000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repair-rank-one@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Repair Rank One"}', now(), now()),
  ('30000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'repair-rank-two@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Repair Rank Two"}', now(), now());

INSERT INTO public.gamification_accounts(user_id, gold_leaves)
VALUES
  ('30000000-0000-0000-0000-000000000001', 5),
  ('30000000-0000-0000-0000-000000000002', 1)
ON CONFLICT (user_id) DO UPDATE
SET gold_leaves = EXCLUDED.gold_leaves;

CREATE TEMP TABLE repair_purchase_results (
  attempt TEXT PRIMARY KEY,
  response JSONB NOT NULL
) ON COMMIT DROP;

SELECT lives_ok(
  $$
    INSERT INTO repair_purchase_results(attempt, response)
    SELECT
      'first',
      public.purchase_gamification_item(
        '30000000-0000-0000-0000-000000000001',
        'streak_freeze',
        2,
        'repair-purchase-0001'
      )
  $$,
  'a funded Gold Leaf purchase succeeds'
);
SELECT is(
  (SELECT (response->>'success')::BOOLEAN FROM repair_purchase_results WHERE attempt = 'first'),
  true,
  'the purchase response reports success'
);
SELECT is(
  (SELECT (response->>'idempotent')::BOOLEAN FROM repair_purchase_results WHERE attempt = 'first'),
  false,
  'the first purchase response is not idempotent'
);
SELECT is(
  (SELECT gold_leaves FROM public.gamification_accounts WHERE user_id = '30000000-0000-0000-0000-000000000001'),
  3,
  'Gold Leaves are debited atomically by unit cost times quantity'
);
SELECT is(
  (
    SELECT quantity
    FROM public.user_gamification_inventory
    WHERE user_id = '30000000-0000-0000-0000-000000000001'
      AND item_code = 'streak_freeze'
  ),
  2,
  'purchased streak freezes are added to inventory'
);
SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.gamification_purchases
    WHERE user_id = '30000000-0000-0000-0000-000000000001'
      AND idempotency_key = 'repair-purchase-0001'
      AND item_code = 'streak_freeze'
      AND quantity = 2
      AND unit_cost_gold_leaves = 1
      AND gold_leaves_spent = 2
  ),
  1,
  'the purchase audit row records the immutable price and total'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.gamification_purchases purchase
    JOIN public.gamification_ledger ledger ON ledger.id = purchase.ledger_id
    WHERE purchase.user_id = '30000000-0000-0000-0000-000000000001'
      AND purchase.idempotency_key = 'repair-purchase-0001'
      AND ledger.user_id = purchase.user_id
      AND ledger.gold_leaves_delta = -2
  ),
  'the purchase is backed by one linked negative-currency ledger entry'
);

SELECT lives_ok(
  $$
    INSERT INTO repair_purchase_results(attempt, response)
    SELECT
      'retry',
      public.purchase_gamification_item(
        '30000000-0000-0000-0000-000000000001',
        'streak_freeze',
        2,
        'repair-purchase-0001'
      )
  $$,
  'retrying the same purchase key succeeds'
);
SELECT is(
  (SELECT (response->>'idempotent')::BOOLEAN FROM repair_purchase_results WHERE attempt = 'retry'),
  true,
  'the retry response reports idempotency'
);
SELECT is(
  (SELECT gold_leaves FROM public.gamification_accounts WHERE user_id = '30000000-0000-0000-0000-000000000001'),
  3,
  'an idempotent retry does not debit Gold Leaves again'
);
SELECT is(
  (
    SELECT quantity
    FROM public.user_gamification_inventory
    WHERE user_id = '30000000-0000-0000-0000-000000000001'
      AND item_code = 'streak_freeze'
  ),
  2,
  'an idempotent retry does not add inventory again'
);
SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.gamification_purchases
    WHERE user_id = '30000000-0000-0000-0000-000000000001'
      AND idempotency_key = 'repair-purchase-0001'
  ),
  1,
  'an idempotent retry keeps one purchase row'
);
SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.gamification_purchases purchase
    JOIN public.gamification_ledger ledger ON ledger.id = purchase.ledger_id
    WHERE purchase.user_id = '30000000-0000-0000-0000-000000000001'
      AND purchase.idempotency_key = 'repair-purchase-0001'
      AND ledger.gold_leaves_delta = -2
  ),
  1,
  'an idempotent retry keeps one currency ledger debit'
);

SELECT throws_ok(
  $$
    SELECT public.purchase_gamification_item(
      '30000000-0000-0000-0000-000000000002',
      'streak_freeze',
      2,
      'repair-insufficient-0001'
    )
  $$,
  'P0001',
  'Insufficient Gold Leaves',
  'an insufficient Gold Leaf balance rejects the whole purchase'
);
SELECT is(
  (SELECT gold_leaves FROM public.gamification_accounts WHERE user_id = '30000000-0000-0000-0000-000000000002'),
  1,
  'a rejected purchase leaves the Gold Leaf balance unchanged'
);
SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.user_gamification_inventory
    WHERE user_id = '30000000-0000-0000-0000-000000000002'
  ),
  0,
  'a rejected purchase creates no inventory'
);
SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.gamification_purchases
    WHERE user_id = '30000000-0000-0000-0000-000000000002'
  ),
  0,
  'a rejected purchase creates no purchase row'
);
SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.gamification_ledger
    WHERE user_id = '30000000-0000-0000-0000-000000000002'
      AND gold_leaves_delta < 0
  ),
  0,
  'a rejected purchase creates no currency debit'
);

-- Streak freezes are owner-bound, local-date aware, inventory-backed, and use a
-- rolling server-side cooldown rather than a client-side calendar-week check.
SELECT has_function(
  'public',
  'use_reading_streak_freeze',
  ARRAY['uuid', 'date'],
  'the secure streak freeze function exists'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.use_reading_streak_freeze(uuid,date)',
    'EXECUTE'
  ),
  'authenticated users can invoke the guarded freeze function'
);

UPDATE public.profiles
SET timezone = 'America/New_York'
WHERE id BETWEEN
  '30000000-0000-0000-0000-000000000003'
  AND '30000000-0000-0000-0000-000000000008';

INSERT INTO public.user_gamification_inventory(user_id, item_code, quantity)
VALUES
  ('30000000-0000-0000-0000-000000000003', 'streak_freeze', 2),
  ('30000000-0000-0000-0000-000000000004', 'streak_freeze', 1),
  ('30000000-0000-0000-0000-000000000005', 'streak_freeze', 1),
  ('30000000-0000-0000-0000-000000000006', 'streak_freeze', 1),
  ('30000000-0000-0000-0000-000000000007', 'streak_freeze', 1);

INSERT INTO public.books(id, user_id, title, author, pages, status)
VALUES
  ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'Freeze Good Book', 'Brack', 200, 'reading'),
  ('31000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'Freeze Date Book', 'Brack', 200, 'reading'),
  ('31000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000006', 'Freeze Cooldown Book', 'Brack', 200, 'reading'),
  ('31000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000007', 'Freeze Ready Book', 'Brack', 200, 'reading'),
  ('31000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000008', 'Freeze Empty Book', 'Brack', 200, 'reading');

INSERT INTO public.reading_sessions(
  id,
  user_id,
  book_id,
  start_time,
  end_time,
  duration
)
VALUES
  (
    '32000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    '31000000-0000-0000-0000-000000000003',
    (((now() AT TIME ZONE 'America/New_York')::DATE - 1) + TIME '12:00') AT TIME ZONE 'America/New_York',
    (((now() AT TIME ZONE 'America/New_York')::DATE - 1) + TIME '12:10') AT TIME ZONE 'America/New_York',
    10
  ),
  (
    '32000000-0000-0000-0000-000000000006',
    '30000000-0000-0000-0000-000000000006',
    '31000000-0000-0000-0000-000000000006',
    (((now() AT TIME ZONE 'America/New_York')::DATE - 1) + TIME '12:00') AT TIME ZONE 'America/New_York',
    (((now() AT TIME ZONE 'America/New_York')::DATE - 1) + TIME '12:10') AT TIME ZONE 'America/New_York',
    10
  ),
  (
    '32000000-0000-0000-0000-000000000007',
    '30000000-0000-0000-0000-000000000007',
    '31000000-0000-0000-0000-000000000007',
    (((now() AT TIME ZONE 'America/New_York')::DATE - 1) + TIME '12:00') AT TIME ZONE 'America/New_York',
    (((now() AT TIME ZONE 'America/New_York')::DATE - 1) + TIME '12:10') AT TIME ZONE 'America/New_York',
    10
  ),
  (
    '32000000-0000-0000-0000-000000000008',
    '30000000-0000-0000-0000-000000000008',
    '31000000-0000-0000-0000-000000000008',
    (((now() AT TIME ZONE 'America/New_York')::DATE - 1) + TIME '12:00') AT TIME ZONE 'America/New_York',
    (((now() AT TIME ZONE 'America/New_York')::DATE - 1) + TIME '12:10') AT TIME ZONE 'America/New_York',
    10
  );

INSERT INTO public.progress_logs(
  id,
  user_id,
  book_id,
  page_number,
  logged_at,
  log_type,
  time_spent_minutes
)
VALUES (
  '33000000-0000-0000-0000-000000000004',
  '30000000-0000-0000-0000-000000000004',
  '31000000-0000-0000-0000-000000000004',
  10,
  now() - INTERVAL '1 minute',
  'manual',
  10
);

UPDATE public.profiles
SET streak_freeze_used_at = now() - INTERVAL '6 days 23 hours'
WHERE id = '30000000-0000-0000-0000-000000000006';

UPDATE public.profiles
SET streak_freeze_used_at = now() - INTERVAL '7 days 1 minute'
WHERE id = '30000000-0000-0000-0000-000000000007';

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);

SELECT throws_ok(
  $$
    SELECT public.use_reading_streak_freeze(
      '30000000-0000-0000-0000-000000000007',
      (now() AT TIME ZONE 'America/New_York')::DATE
    )
  $$,
  '42501',
  'Not allowed to use a streak freeze for this user',
  'a user cannot consume another user''s streak freeze'
);
SELECT is(
  (
    SELECT quantity
    FROM public.user_gamification_inventory
    WHERE user_id = '30000000-0000-0000-0000-000000000007'
      AND item_code = 'streak_freeze'
  ),
  1,
  'an unauthorized freeze attempt leaves the owner inventory unchanged'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000004', true);
SELECT throws_ok(
  $$
    SELECT public.use_reading_streak_freeze(
      '30000000-0000-0000-0000-000000000004',
      (now() AT TIME ZONE 'America/New_York')::DATE + 1
    )
  $$,
  '22023',
  'Streak freeze date must be the user''s current local date',
  'a freeze cannot be applied outside the user''s current local date'
);
SELECT is(
  (
    SELECT quantity
    FROM public.user_gamification_inventory
    WHERE user_id = '30000000-0000-0000-0000-000000000004'
      AND item_code = 'streak_freeze'
  ),
  1,
  'an invalid local-date attempt consumes no inventory'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000005', true);
SELECT throws_ok(
  $$
    SELECT public.use_reading_streak_freeze(
      '30000000-0000-0000-0000-000000000005',
      (now() AT TIME ZONE 'America/New_York')::DATE
    )
  $$,
  'P0001',
  'A streak freeze requires reading activity on the previous local day',
  'a freeze cannot begin a streak without prior-day reading'
);
SELECT is(
  (
    SELECT quantity
    FROM public.user_gamification_inventory
    WHERE user_id = '30000000-0000-0000-0000-000000000005'
      AND item_code = 'streak_freeze'
  ),
  1,
  'a missing-prior-day attempt consumes no inventory'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000006', true);
SELECT throws_ok(
  $$
    SELECT public.use_reading_streak_freeze(
      '30000000-0000-0000-0000-000000000006',
      (now() AT TIME ZONE 'America/New_York')::DATE
    )
  $$,
  'P0001',
  'Streak freeze is on cooldown',
  'the server enforces a rolling seven-day cooldown'
);
SELECT is(
  (
    SELECT quantity
    FROM public.user_gamification_inventory
    WHERE user_id = '30000000-0000-0000-0000-000000000006'
      AND item_code = 'streak_freeze'
  ),
  1,
  'a cooldown rejection consumes no inventory'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000007","role":"authenticated"}',
  true
);
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000007', true);
SELECT lives_ok(
  $$
    SELECT public.use_reading_streak_freeze(
      '30000000-0000-0000-0000-000000000007',
      (now() AT TIME ZONE 'America/New_York')::DATE
    )
  $$,
  'a freeze succeeds once the rolling cooldown has elapsed'
);
SELECT is(
  (
    SELECT quantity
    FROM public.user_gamification_inventory
    WHERE user_id = '30000000-0000-0000-0000-000000000007'
      AND item_code = 'streak_freeze'
  ),
  0,
  'a successful post-cooldown freeze consumes one inventory item'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.reading_streak_days
    WHERE user_id = '30000000-0000-0000-0000-000000000007'
      AND activity_date = (now() AT TIME ZONE 'America/New_York')::DATE
      AND used_freeze
      AND session_count = 0
      AND progress_log_count = 0
  ),
  'a successful freeze records the user-local day without fake reading activity'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
SELECT lives_ok(
  $$
    SELECT public.use_reading_streak_freeze(
      '30000000-0000-0000-0000-000000000003',
      (now() AT TIME ZONE 'America/New_York')::DATE
    )
  $$,
  'an owned, funded freeze with prior-day reading succeeds'
);
SELECT is(
  (
    SELECT quantity
    FROM public.user_gamification_inventory
    WHERE user_id = '30000000-0000-0000-0000-000000000003'
      AND item_code = 'streak_freeze'
  ),
  1,
  'the first same-day freeze consumes exactly one item'
);
SELECT lives_ok(
  $$
    SELECT public.use_reading_streak_freeze(
      '30000000-0000-0000-0000-000000000003',
      (now() AT TIME ZONE 'America/New_York')::DATE
    )
  $$,
  'retrying an already-applied same-day freeze is idempotent'
);
SELECT is(
  (
    SELECT quantity
    FROM public.user_gamification_inventory
    WHERE user_id = '30000000-0000-0000-0000-000000000003'
      AND item_code = 'streak_freeze'
  ),
  1,
  'a same-day retry does not consume another inventory item'
);
SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.reading_streak_days
    WHERE user_id = '30000000-0000-0000-0000-000000000003'
      AND activity_date = (now() AT TIME ZONE 'America/New_York')::DATE
      AND used_freeze
  ),
  1,
  'a same-day retry retains one freeze day'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000008","role":"authenticated"}',
  true
);
SELECT set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000008', true);
SELECT throws_ok(
  $$
    SELECT public.use_reading_streak_freeze(
      '30000000-0000-0000-0000-000000000008',
      (now() AT TIME ZONE 'America/New_York')::DATE
    )
  $$,
  'P0001',
  'No streak freeze is available in inventory',
  'a user cannot create a free freeze with empty inventory'
);
SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.reading_streak_days
    WHERE user_id = '30000000-0000-0000-0000-000000000008'
      AND activity_date = (now() AT TIME ZONE 'America/New_York')::DATE
      AND used_freeze
  ),
  0,
  'an empty-inventory rejection creates no freeze day'
);

-- League leaderboards include assigned zero-score readers and rank changes are
-- recomputed for every displaced member, not only the user who scored.
UPDATE public.profiles
SET
  leaderboard_opt_in = true,
  leaderboard_eligible_from = DATE '2001-01-01',
  gamification_profile_visible = true,
  profile_visibility = 'public'
WHERE id IN (
  '30000000-0000-0000-0000-000000000009',
  '30000000-0000-0000-0000-000000000010'
);

CREATE TEMP TABLE repair_rank_context (
  week_id UUID PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO repair_rank_context(week_id)
SELECT (public.ensure_gamification_week(DATE '2001-01-01')).id;

SELECT public.assign_reader_leagues((SELECT week_id FROM repair_rank_context));

INSERT INTO public.gamification_weekly_scores(
  week_id,
  user_id,
  competitive_ink,
  quests_completed,
  qualifying_minutes,
  reading_days,
  score_attained_at
)
VALUES (
  (SELECT week_id FROM repair_rank_context),
  '30000000-0000-0000-0000-000000000009',
  10,
  0,
  10,
  1,
  now()
);

SELECT is(
  jsonb_array_length(
    public.get_reader_leaderboard(
      '30000000-0000-0000-0000-000000000009',
      'league',
      (SELECT week_id FROM repair_rank_context),
      100
    )->'entries'
  ),
  2,
  'a league leaderboard includes all assigned members'
);
SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      public.get_reader_leaderboard(
        '30000000-0000-0000-0000-000000000009',
        'league',
        (SELECT week_id FROM repair_rank_context),
        100
      )->'entries'
    ) entry
    WHERE entry->>'user_id' = '30000000-0000-0000-0000-000000000010'
      AND (entry->>'competitive_ink')::INTEGER = 0
  ),
  'an assigned reader with no score appears with zero competitive Ink'
);
SELECT is(
  public.refresh_reader_league_rank(
    '30000000-0000-0000-0000-000000000009',
    (SELECT week_id FROM repair_rank_context),
    now()
  ),
  1,
  'the initial scoring reader is ranked first'
);
SELECT is(
  (
    SELECT provisional_rank
    FROM public.reader_league_members
    WHERE user_id = '30000000-0000-0000-0000-000000000009'
      AND league_id IN (
        SELECT id FROM public.reader_leagues
        WHERE week_id = (SELECT week_id FROM repair_rank_context)
      )
  ),
  1,
  'the initial leader membership stores rank one'
);
SELECT is(
  (
    SELECT provisional_rank
    FROM public.reader_league_members
    WHERE user_id = '30000000-0000-0000-0000-000000000010'
      AND league_id IN (
        SELECT id FROM public.reader_leagues
        WHERE week_id = (SELECT week_id FROM repair_rank_context)
      )
  ),
  2,
  'rank refresh also initializes the zero-score member rank'
);

INSERT INTO public.gamification_weekly_scores(
  week_id,
  user_id,
  competitive_ink,
  quests_completed,
  qualifying_minutes,
  reading_days,
  score_attained_at
)
VALUES (
  (SELECT week_id FROM repair_rank_context),
  '30000000-0000-0000-0000-000000000010',
  20,
  0,
  20,
  1,
  now()
);

SELECT is(
  public.refresh_reader_league_rank(
    '30000000-0000-0000-0000-000000000010',
    (SELECT week_id FROM repair_rank_context),
    now()
  ),
  1,
  'the higher-scoring reader moves to rank one'
);
SELECT is(
  (
    SELECT provisional_rank
    FROM public.reader_league_members
    WHERE user_id = '30000000-0000-0000-0000-000000000010'
      AND league_id IN (
        SELECT id FROM public.reader_leagues
        WHERE week_id = (SELECT week_id FROM repair_rank_context)
      )
  ),
  1,
  'the new leader membership is recomputed to rank one'
);
SELECT is(
  (
    SELECT provisional_rank
    FROM public.reader_league_members
    WHERE user_id = '30000000-0000-0000-0000-000000000009'
      AND league_id IN (
        SELECT id FROM public.reader_leagues
        WHERE week_id = (SELECT week_id FROM repair_rank_context)
      )
  ),
  2,
  'the displaced reader membership is recomputed to rank two'
);

-- The cron row contains only a stable helper call. The helper resolves both
-- secrets from Vault at execution time and constructs JSON rather than storing
-- a secret or a quote-fragile JSON literal in cron.job.
SELECT has_function(
  'public',
  'invoke_gamification_worker',
  ARRAY[]::TEXT[],
  'the worker cron helper exists'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.invoke_gamification_worker()',
    'EXECUTE'
  ),
  'authenticated clients cannot invoke the worker helper'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.invoke_gamification_worker()',
    'EXECUTE'
  ),
  'the service role can invoke the worker helper'
);
SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM cron.job
    WHERE jobname = 'brack-gamification-worker'
      AND active
  ),
  1,
  'exactly one active gamification worker cron job exists'
);
SELECT ok(
  (
    SELECT command ~* '^\s*select\s+public\.invoke_gamification_worker\s*\(\s*\)\s*;?\s*$'
    FROM cron.job
    WHERE jobname = 'brack-gamification-worker'
  ),
  'the worker cron command contains only the stable helper call'
);
SELECT ok(
  pg_get_functiondef('public.invoke_gamification_worker()'::REGPROCEDURE)
    ~* 'vault\.decrypted_secrets',
  'the worker helper resolves secrets from Vault at execution time'
);
SELECT ok(
  pg_get_functiondef('public.invoke_gamification_worker()'::REGPROCEDURE)
    ~* 'jsonb_build_object\s*\(\s*''source''\s*,\s*''cron''\s*\)',
  'the worker helper constructs its request body with jsonb_build_object'
);
SELECT ok(
  (
    SELECT (
      command || pg_get_functiondef('public.invoke_gamification_worker()'::REGPROCEDURE)
    ) !~* '\{[[:space:]]*"?source"?[[:space:]]*:'
    FROM cron.job
    WHERE jobname = 'brack-gamification-worker'
  ),
  'the worker schedule contains no quote-fragile JSON body literal'
);
SELECT ok(
  pg_get_functiondef('public.invoke_gamification_worker()'::REGPROCEDURE)
    !~* '''X-Brack-Worker-Secret''\s*,\s*''[^'']+''',
  'the worker helper contains no literal header secret'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM cron.job job
    CROSS JOIN vault.decrypted_secrets secret
    WHERE job.jobname = 'brack-gamification-worker'
      AND secret.name = 'gamification_worker_secret'
      AND NULLIF(secret.decrypted_secret, '') IS NOT NULL
      AND position(
        secret.decrypted_secret IN
        job.command || pg_get_functiondef('public.invoke_gamification_worker()'::REGPROCEDURE)
      ) > 0
  ),
  'the current Vault worker secret is not persisted in cron or helper SQL'
);

SELECT * FROM finish();
ROLLBACK;
