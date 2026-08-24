BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(10);

SELECT has_function(
  'public',
  'auth_email_exists',
  ARRAY['text'],
  'the backend-only Auth email predicate exists'
);

SELECT ok(
  (
    SELECT procedure.prosecdef
      AND 'search_path=pg_catalog, pg_temp' = ANY(
        COALESCE(procedure.proconfig, ARRAY[]::TEXT[])
      )
    FROM pg_proc AS procedure
    WHERE procedure.oid = to_regprocedure('public.auth_email_exists(text)')
  ),
  'the predicate is security-definer with a fixed safe search path'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.auth_email_exists(text)',
    'EXECUTE'
  ),
  'anonymous database clients cannot execute the predicate directly'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.auth_email_exists(text)',
    'EXECUTE'
  ),
  'authenticated database clients cannot execute the predicate directly'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.auth_email_exists(text)',
    'EXECUTE'
  ),
  'only the service-backed Edge path can execute the predicate'
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
    '73000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'confirmed-reader@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '73000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'pending-reader@example.com',
    '',
    NULL,
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  ),
  (
    '73000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'google-reader@example.com',
    '',
    now(),
    '{"provider":"google","providers":["google"]}',
    '{}',
    now(),
    now()
  );

SELECT is(
  public.auth_email_exists('confirmed-reader@example.com'),
  TRUE,
  'a confirmed email account is detected'
);

SELECT is(
  public.auth_email_exists('  PENDING-READER@EXAMPLE.COM  '),
  TRUE,
  'an unconfirmed account is detected case-insensitively after trimming'
);

SELECT is(
  public.auth_email_exists('google-reader@example.com'),
  TRUE,
  'a Google-created account is detected by its Auth email'
);

SELECT is(
  public.auth_email_exists('new-reader@example.com'),
  FALSE,
  'an unused email is available'
);

SELECT is(
  public.auth_email_exists(NULL),
  FALSE,
  'null input never matches an Auth account'
);

SELECT * FROM finish();
ROLLBACK;
