BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(13);

SELECT has_function(
  'public',
  'claim_push_token',
  ARRAY['text', 'text'],
  'the authenticated push-token claim function exists'
);

SELECT ok(
  (
    SELECT procedure.prosecdef
      AND 'search_path=""' = ANY(
        COALESCE(procedure.proconfig, ARRAY[]::TEXT[])
      )
    FROM pg_proc AS procedure
    WHERE procedure.oid = to_regprocedure('public.claim_push_token(text,text)')
  ),
  'the claim function is security-definer with an empty search path'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.claim_push_token(text,text)',
    'EXECUTE'
  ),
  'anonymous callers cannot claim a push token'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.claim_push_token(text,text)',
    'EXECUTE'
  ),
  'authenticated callers can claim their installation token'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_state
    WHERE constraint_state.conname = 'push_tokens_token_key'
      AND constraint_state.conrelid = to_regclass('public.push_tokens')
      AND constraint_state.contype = 'u'
      AND constraint_state.convalidated
  ),
  'a validated global token uniqueness constraint exists'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies AS policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename = 'push_tokens'
      AND policy.policyname = 'Users can update their own push tokens'
      AND policy.cmd = 'UPDATE'
      AND policy.qual IS NOT NULL
      AND policy.with_check IS NOT NULL
  ),
  'push-token updates enforce ownership before and after the write'
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
    '74000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'push-owner-one@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '74000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'push-owner-two@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

INSERT INTO public.profiles(id, display_name)
VALUES
  ('74000000-0000-0000-0000-000000000001', 'Push Owner One'),
  ('74000000-0000-0000-0000-000000000002', 'Push Owner Two')
ON CONFLICT (id) DO NOTHING;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"74000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SELECT set_config(
  'request.jwt.claim.sub',
  '74000000-0000-0000-0000-000000000001',
  true
);

SELECT lives_ok(
  $$ SELECT public.claim_push_token('installation-token', 'ios') $$,
  'the first reader can claim an installation token'
);

SELECT is(
  (
    SELECT push_tokens.user_id
    FROM public.push_tokens
    WHERE push_tokens.token = 'installation-token'
  ),
  '74000000-0000-0000-0000-000000000001'::UUID,
  'the first claim records the verified current user'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"74000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
SELECT set_config(
  'request.jwt.claim.sub',
  '74000000-0000-0000-0000-000000000002',
  true
);

SELECT lives_ok(
  $$ SELECT public.claim_push_token('installation-token', 'android') $$,
  'a device account switch atomically transfers the token'
);

SELECT results_eq(
  $$
    SELECT push_tokens.user_id, push_tokens.platform
    FROM public.push_tokens
    WHERE push_tokens.token = 'installation-token'
  $$,
  $$ VALUES ('74000000-0000-0000-0000-000000000002'::UUID, 'android'::TEXT) $$,
  'the token has exactly one current owner and the current platform'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.push_tokens
    WHERE push_tokens.token = 'installation-token'
  ),
  1,
  'ownership transfer never duplicates the installation token'
);

SELECT throws_ok(
  $$ SELECT public.claim_push_token('   ', 'ios') $$,
  '22023',
  'Push token is invalid.',
  'blank tokens are rejected'
);

SELECT throws_ok(
  $$ SELECT public.claim_push_token('another-token', 'desktop') $$,
  '22023',
  'Push platform is invalid.',
  'unknown platforms are rejected'
);

SELECT * FROM finish();
ROLLBACK;
