-- Read-only production contracts for data and non-public invariants that the
-- typed public-schema fingerprint cannot prove.
-- This query must remain a single SELECT and must never mutate production data.
WITH
expected_functions(signature, authenticated_execute, service_execute, search_path_setting) AS (
  VALUES
    ('public.reorder_library_shelf(uuid,uuid[])', TRUE, FALSE, 'search_path=public, pg_temp'),
    ('public.add_library_book(uuid,jsonb)', FALSE, TRUE, 'search_path=public, pg_temp'),
    ('public.add_library_book_without_series(uuid,jsonb)', FALSE, TRUE, 'search_path=public, pg_temp'),
    ('public.auth_email_exists(text)', FALSE, TRUE, 'search_path=pg_catalog, pg_temp')
),
function_contracts AS (
  SELECT
    expected.signature,
    procedure.oid IS NOT NULL
      AND procedure.prosecdef
      AND expected.search_path_setting = ANY(COALESCE(procedure.proconfig, ARRAY[]::TEXT[]))
      AND NOT has_function_privilege('anon', procedure.oid, 'EXECUTE')
      AND has_function_privilege('authenticated', procedure.oid, 'EXECUTE') = expected.authenticated_execute
      AND has_function_privilege('service_role', procedure.oid, 'EXECUTE') = expected.service_execute
      AND NOT EXISTS (
        SELECT 1
        FROM aclexplode(COALESCE(procedure.proacl, acldefault('f', procedure.proowner))) AS privilege
        WHERE privilege.grantee = 0
          AND privilege.privilege_type = 'EXECUTE'
      ) AS ok
  FROM expected_functions AS expected
  LEFT JOIN pg_proc AS procedure
    ON procedure.oid = to_regprocedure(expected.signature)
),
expected_buckets(id, is_public, file_size_limit, allowed_mime_types) AS (
  VALUES
    ('avatars'::TEXT, TRUE, NULL::BIGINT, NULL::TEXT[]),
    ('book-covers', TRUE, NULL::BIGINT, NULL::TEXT[]),
    ('post-media', FALSE, NULL::BIGINT, NULL::TEXT[]),
    (
      'club-media',
      FALSE,
      62914560::BIGINT,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']::TEXT[]
    ),
    (
      'message-media',
      FALSE,
      8388608::BIGINT,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::TEXT[]
    )
),
bucket_contracts AS (
  SELECT
    expected.id,
    bucket.id IS NOT NULL
      AND bucket.public = expected.is_public
      AND bucket.file_size_limit IS NOT DISTINCT FROM expected.file_size_limit
      AND bucket.allowed_mime_types IS NOT DISTINCT FROM expected.allowed_mime_types
      AS ok
  FROM expected_buckets AS expected
  LEFT JOIN storage.buckets AS bucket ON bucket.id = expected.id
),
expected_storage_policies(policy_name, command) AS (
  VALUES
    ('Users can delete own message media', 'DELETE'),
    ('Users can delete their own avatar', 'DELETE'),
    ('Users can delete their own book covers', 'DELETE'),
    ('Users can delete their own club media', 'DELETE'),
    ('Users can delete their own post media', 'DELETE'),
    ('Users can update own message media', 'UPDATE'),
    ('Users can update their own avatar', 'UPDATE'),
    ('Users can update their own book covers', 'UPDATE'),
    ('Users can update their own club media', 'UPDATE'),
    ('Users can update their own post media', 'UPDATE'),
    ('Users can upload own message media', 'INSERT'),
    ('Users can upload their own avatar', 'INSERT'),
    ('Users can upload their own book covers', 'INSERT'),
    ('Users can upload their own club media', 'INSERT'),
    ('Users can upload their own post media', 'INSERT')
),
missing_storage_policies AS (
  SELECT expected.policy_name, expected.command
  FROM expected_storage_policies AS expected
  LEFT JOIN pg_policies AS policy
    ON policy.schemaname = 'storage'
   AND policy.tablename = 'objects'
   AND policy.policyname = expected.policy_name
   AND policy.cmd = expected.command
  WHERE policy.policyname IS NULL
),
duplicate_shelf_positions AS (
  SELECT books.user_id, books.shelf_position
  FROM public.books
  WHERE books.deleted_at IS NULL
  GROUP BY books.user_id, books.shelf_position
  HAVING COUNT(*) > 1
),
duplicate_auth_email_users AS (
  SELECT LOWER(BTRIM(users.email)) AS normalized_email
  FROM auth.users AS users
  WHERE users.email IS NOT NULL
    AND BTRIM(users.email) <> ''
    AND NOT COALESCE(users.is_sso_user, FALSE)
  GROUP BY LOWER(BTRIM(users.email))
  HAVING COUNT(*) > 1
),
duplicate_identity_email_users AS (
  SELECT LOWER(BTRIM(identities.identity_data->>'email')) AS normalized_email
  FROM auth.identities AS identities
  WHERE COALESCE(BTRIM(identities.identity_data->>'email'), '') <> ''
  GROUP BY LOWER(BTRIM(identities.identity_data->>'email'))
  HAVING COUNT(DISTINCT identities.user_id) > 1
),
auth_profile_link_violations AS (
  SELECT users.id
  FROM auth.users AS users
  LEFT JOIN public.profiles AS profiles ON profiles.id = users.id
  WHERE profiles.id IS NULL

  UNION ALL

  SELECT profiles.id
  FROM public.profiles AS profiles
  LEFT JOIN auth.users AS users ON users.id = profiles.id
  WHERE users.id IS NULL
)
SELECT
  'books.shelf_position column'::TEXT AS contract,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'books'
      AND column_name = 'shelf_position'
      AND data_type = 'integer'
  ) AS ok,
  'required integer column'::TEXT AS detail
UNION ALL
SELECT
  'active books have shelf positions',
  NOT EXISTS (
    SELECT 1 FROM public.books
    WHERE deleted_at IS NULL AND shelf_position IS NULL
  ),
  FORMAT(
    'violations=%s',
    (SELECT COUNT(*) FROM public.books WHERE deleted_at IS NULL AND shelf_position IS NULL)
  )
UNION ALL
SELECT
  'active shelf positions are unique per user',
  NOT EXISTS (SELECT 1 FROM duplicate_shelf_positions),
  FORMAT('duplicate_groups=%s', (SELECT COUNT(*) FROM duplicate_shelf_positions))
UNION ALL
SELECT
  'books shelf ordering index',
  EXISTS (
    SELECT 1
    FROM pg_index AS index_state
    JOIN pg_class AS index_relation ON index_relation.oid = index_state.indexrelid
    JOIN pg_class AS table_relation ON table_relation.oid = index_state.indrelid
    JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_relation.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND table_relation.relname = 'books'
      AND index_relation.relname = 'idx_books_user_shelf_position'
      AND index_state.indisvalid
      AND index_state.indisready
      AND pg_get_indexdef(index_state.indexrelid) LIKE '%(user_id, shelf_position)%'
      AND pg_get_expr(index_state.indpred, index_state.indrelid) = '(deleted_at IS NULL)'
  ),
  'valid partial user/order index required'
UNION ALL
SELECT
  'protected application functions',
  COALESCE(BOOL_AND(ok), FALSE) AND COUNT(*) = 4,
  COALESCE(STRING_AGG(signature, ', ' ORDER BY signature) FILTER (WHERE NOT ok), 'all valid')
FROM function_contracts
UNION ALL
SELECT
  'core telemetry user deletion cascades',
  EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_state
    WHERE constraint_state.conname = 'core_telemetry_events_user_id_fkey'
      AND constraint_state.conrelid = to_regclass('public.core_telemetry_events')
      AND constraint_state.contype = 'f'
      AND constraint_state.confdeltype = 'c'
      AND constraint_state.convalidated
  ),
  'validated ON DELETE CASCADE foreign key required'
UNION ALL
SELECT
  'auth profile creation trigger',
  EXISTS (
    SELECT 1
    FROM pg_trigger AS trigger_state
    WHERE trigger_state.tgname = 'on_auth_user_created'
      AND trigger_state.tgrelid = to_regclass('auth.users')
      AND trigger_state.tgfoid = to_regprocedure('public.handle_new_user()')
      AND NOT trigger_state.tgisinternal
      AND trigger_state.tgenabled <> 'D'
      AND pg_get_triggerdef(trigger_state.oid) LIKE '%AFTER INSERT%'
  ),
  'enabled AFTER INSERT trigger on auth.users required'
UNION ALL
SELECT
  'auth emails map to one non-SSO user',
  NOT EXISTS (SELECT 1 FROM duplicate_auth_email_users),
  FORMAT(
    'normalized_duplicate_groups=%s',
    (SELECT COUNT(*) FROM duplicate_auth_email_users)
  )
UNION ALL
SELECT
  'auth identity emails map to one user',
  NOT EXISTS (SELECT 1 FROM duplicate_identity_email_users),
  FORMAT(
    'cross_user_duplicate_groups=%s',
    (SELECT COUNT(*) FROM duplicate_identity_email_users)
  )
UNION ALL
SELECT
  'auth users and profiles are one-to-one',
  NOT EXISTS (SELECT 1 FROM auth_profile_link_violations),
  FORMAT(
    'missing_or_orphaned_profiles=%s',
    (SELECT COUNT(*) FROM auth_profile_link_violations)
  )
UNION ALL
SELECT
  'profiles use auth user identity as primary key',
  EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_state
    WHERE constraint_state.conname = 'profiles_pkey'
      AND constraint_state.conrelid = to_regclass('public.profiles')
      AND constraint_state.contype = 'p'
      AND constraint_state.conkey = ARRAY[
        (SELECT attribute.attnum
         FROM pg_attribute AS attribute
         WHERE attribute.attrelid = to_regclass('public.profiles')
           AND attribute.attname = 'id')
      ]::SMALLINT[]
  )
  AND EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_state
    WHERE constraint_state.conname = 'profiles_id_fkey'
      AND constraint_state.conrelid = to_regclass('public.profiles')
      AND constraint_state.confrelid = to_regclass('auth.users')
      AND constraint_state.contype = 'f'
      AND constraint_state.confdeltype = 'c'
      AND constraint_state.convalidated
  ),
  'profiles.id must be the PK and a validated cascading FK to auth.users.id'
UNION ALL
SELECT
  'required storage buckets',
  COALESCE(BOOL_AND(ok), FALSE) AND COUNT(*) = 5,
  COALESCE(STRING_AGG(id, ', ' ORDER BY id) FILTER (WHERE NOT ok), 'all valid')
FROM bucket_contracts
UNION ALL
SELECT
  'required storage object policies',
  NOT EXISTS (SELECT 1 FROM missing_storage_policies),
  COALESCE(
    (SELECT STRING_AGG(policy_name || ' [' || command || ']', ', ' ORDER BY policy_name)
     FROM missing_storage_policies),
    'all present'
  )
UNION ALL
SELECT
  'realtime messaging publication',
  NOT EXISTS (
    SELECT required.table_name
    FROM (VALUES ('conversations'::TEXT), ('messages'::TEXT)) AS required(table_name)
    LEFT JOIN pg_publication_tables AS published
      ON published.pubname = 'supabase_realtime'
     AND published.schemaname = 'public'
     AND published.tablename = required.table_name
    WHERE published.tablename IS NULL
  ),
  'conversations and messages must be published'
UNION ALL
SELECT
  'row level security on public tables',
  NOT EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
      AND NOT relation.relrowsecurity
  ),
  COALESCE(
    (SELECT STRING_AGG(relation.relname, ', ' ORDER BY relation.relname)
     FROM pg_class AS relation
     JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname = 'public'
       AND relation.relkind IN ('r', 'p')
       AND NOT relation.relrowsecurity),
    'all enabled'
  )
UNION ALL
SELECT
  'validated public constraints',
  NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS constraint_state
    JOIN pg_namespace AS namespace ON namespace.oid = constraint_state.connamespace
    WHERE namespace.nspname = 'public'
      AND NOT constraint_state.convalidated
  ),
  COALESCE(
    (SELECT STRING_AGG(constraint_state.conname, ', ' ORDER BY constraint_state.conname)
     FROM pg_constraint AS constraint_state
     JOIN pg_namespace AS namespace ON namespace.oid = constraint_state.connamespace
     WHERE namespace.nspname = 'public'
       AND NOT constraint_state.convalidated),
    'all validated'
  )
UNION ALL
SELECT
  'valid public indexes',
  NOT EXISTS (
    SELECT 1
    FROM pg_index AS index_state
    JOIN pg_class AS index_relation ON index_relation.oid = index_state.indexrelid
    JOIN pg_class AS table_relation ON table_relation.oid = index_state.indrelid
    JOIN pg_namespace AS namespace ON namespace.oid = table_relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND (NOT index_state.indisvalid OR NOT index_state.indisready)
  ),
  COALESCE(
    (SELECT STRING_AGG(index_relation.relname, ', ' ORDER BY index_relation.relname)
     FROM pg_index AS index_state
     JOIN pg_class AS index_relation ON index_relation.oid = index_state.indexrelid
     JOIN pg_class AS table_relation ON table_relation.oid = index_state.indrelid
     JOIN pg_namespace AS namespace ON namespace.oid = table_relation.relnamespace
     WHERE namespace.nspname = 'public'
       AND (NOT index_state.indisvalid OR NOT index_state.indisready)),
    'all valid'
  )
ORDER BY contract;
