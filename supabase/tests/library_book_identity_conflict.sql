BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(6);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.add_library_book(uuid,jsonb)',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the security-definer book resolver'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.add_library_book(uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated callers use the protected Edge layer instead of the security-definer RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.add_library_book_without_series(uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated callers cannot bypass the public wrapper'
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
    '21000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'book-collision-owner@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Book Collision Owner"}',
    now(),
    now()
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'book-collision-neighbor@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Book Collision Neighbor"}',
    now(),
    now()
  );

INSERT INTO public.profiles(id, display_name)
VALUES
  ('21000000-0000-0000-0000-000000000001', 'Book Collision Owner'),
  ('21000000-0000-0000-0000-000000000002', 'Book Collision Neighbor')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.books(id, user_id, title, author, status)
VALUES (
  '21000000-0000-0000-0000-000000000100',
  '21000000-0000-0000-0000-000000000002',
  'Neighbor Book',
  'Brack',
  'to_read'
);

CREATE TEMP TABLE collision_result AS
SELECT public.add_library_book(
  '21000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'id', '21000000-0000-0000-0000-000000000100',
    'title', 'Recovered Offline Book',
    'author', 'Brack',
    'status', 'reading'
  )
) AS value;

SELECT is(
  (SELECT value->>'success' FROM collision_result),
  'true',
  'a globally colliding stale UUID is recovered automatically'
);

SELECT isnt(
  (SELECT value->>'book_id' FROM collision_result),
  '21000000-0000-0000-0000-000000000100',
  'collision recovery allocates a safe server UUID'
);

SELECT is(
  (
    SELECT count(*)::INTEGER
    FROM public.books
    WHERE user_id = '21000000-0000-0000-0000-000000000001'
      AND title = 'Recovered Offline Book'
      AND deleted_at IS NULL
  ),
  1,
  'collision recovery creates exactly one active owner-scoped book'
);

SELECT * FROM finish();
ROLLBACK;
