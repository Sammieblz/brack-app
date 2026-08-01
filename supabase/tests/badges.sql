BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(15);

SELECT has_column('public', 'badges', 'code', 'badges have stable codes');
SELECT has_column('public', 'badges', 'category', 'badges have categories');
SELECT has_column('public', 'badges', 'rarity', 'badges have rarity');
SELECT has_column('public', 'badges', 'metric_key', 'badges have metric rules');
SELECT has_column('public', 'user_badges', 'source', 'earned badges record award source');
SELECT has_function(
  'public',
  'get_badge_metric_snapshot',
  ARRAY['uuid'],
  'badge metric snapshot exists'
);
SELECT has_function(
  'public',
  'get_user_badge_catalog',
  ARRAY['uuid'],
  'badge catalog API exists'
);

SELECT cmp_ok(
  (SELECT COUNT(*) FROM public.badges WHERE is_active),
  '>=',
  50::BIGINT,
  'the active catalog contains at least fifty badges'
);

SELECT is(
  (SELECT COUNT(DISTINCT category) FROM public.badges WHERE is_active),
  8::BIGINT,
  'the catalog spans eight progression categories'
);

SELECT is(
  (SELECT COUNT(*) FROM public.badges WHERE rarity = 'legendary' AND is_active),
  5::BIGINT,
  'legendary milestones remain deliberately scarce'
);

SELECT ok(
  NOT has_table_privilege('authenticated', 'public.user_badges', 'INSERT'),
  'clients cannot directly award badges'
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
  'badge-tests@example.com',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Badge Tests"}',
  now(),
  now()
);

INSERT INTO public.books(
  id,
  user_id,
  title,
  author,
  genre,
  pages,
  current_page,
  status,
  date_finished
)
SELECT
  gen_random_uuid(),
  '20000000-0000-0000-0000-000000000001',
  'Completed Book ' || value,
  'Author ' || value,
  'Genre ' || value,
  120,
  120,
  'completed',
  CURRENT_DATE
FROM generate_series(1, 10) value;

SELECT lives_ok(
  $$
    SELECT public.award_badges(
      '20000000-0000-0000-0000-000000000001',
      'manual_check'
    )
  $$,
  'badge evaluation succeeds'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.user_badges earned
    JOIN public.badges badge ON badge.id = earned.badge_id
    WHERE earned.user_id = '20000000-0000-0000-0000-000000000001'
      AND badge.code = 'bookworm'
  ),
  'completion milestones award from canonical book data'
);

SELECT is(
  (
    SELECT COUNT(*)
    FROM public.user_badges
    WHERE user_id = '20000000-0000-0000-0000-000000000001'
  ),
  (
    SELECT COUNT(DISTINCT badge_id)
    FROM public.user_badges
    WHERE user_id = '20000000-0000-0000-0000-000000000001'
  ),
  'badge ownership remains idempotent'
);

SELECT ok(
  (
    SELECT (public.get_user_badge_catalog(
      '20000000-0000-0000-0000-000000000001'
    )->>'total_count')::INTEGER >= 50
  ),
  'catalog response includes the expanded progression'
);

SELECT * FROM finish();
ROLLBACK;
