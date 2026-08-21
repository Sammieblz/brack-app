BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(17);

SELECT has_column(
  'public',
  'books',
  'shelf_position',
  'books expose a persisted shelf position'
);

SELECT col_type_is(
  'public',
  'books',
  'shelf_position',
  'integer',
  'shelf positions use integer ordering'
);

SELECT has_index(
  'public',
  'books',
  'idx_books_user_shelf_position',
  'active shelf ordering has a supporting index'
);

SELECT has_function(
  'public',
  'reorder_library_shelf',
  ARRAY['uuid', 'uuid[]'],
  'the shelf reorder transaction exists'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.reorder_library_shelf(uuid,uuid[])',
    'EXECUTE'
  ),
  'authenticated readers can reorder their own shelf'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.reorder_library_shelf(uuid,uuid[])',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the shelf reorder transaction'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.add_library_book(uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated clients cannot bypass the protected add-book Edge path'
);

SELECT ok(
  POSITION(
    'shelf_position'
    IN pg_get_functiondef('public.add_library_book(uuid,jsonb)'::REGPROCEDURE)
  ) > 0,
  'the current add-book wrapper assigns and returns shelf positions'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.books
    WHERE deleted_at IS NULL
      AND shelf_position IS NULL
  ),
  'all active books receive a shelf position during migration'
);

SELECT ok(
  POSITION(
    'pg_advisory_xact_lock'
    IN pg_get_functiondef(
      'public.add_library_book_without_series(uuid,jsonb)'::REGPROCEDURE
    )
  ) > 0
  AND POSITION(
    'shelf_position'
    IN pg_get_functiondef(
      'public.add_library_book_without_series(uuid,jsonb)'::REGPROCEDURE
    )
  ) > 0,
  'the private add-book helper serializes shelf allocation and persists order'
);

SELECT ok(
  'search_path=public, pg_temp' = ANY(
    COALESCE(
      (SELECT proconfig
       FROM pg_proc
       WHERE oid = 'public.add_library_book_without_series(uuid,jsonb)'::REGPROCEDURE),
      ARRAY[]::TEXT[]
    )
  ),
  'the private add-book helper has a hardened search path'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = 'public.social_activities'::REGCLASS
      AND attname = 'created_at'
      AND attnotnull
      AND NOT attisdropped
  ),
  'social activity timestamps cannot be null'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.social_activities'::REGCLASS
      AND conname = 'social_activities_visibility_check'
      AND convalidated
  ),
  'social activity visibility is constrained and validated'
);

SELECT is(
  (SELECT relreplident::TEXT
   FROM pg_class
   WHERE oid = 'public.social_activities'::REGCLASS),
  'f',
  'social activities retain full replica identity'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM pg_constraint
    WHERE conname IN (
      'profiles_id_fkey',
      'social_activities_badge_id_fkey',
      'social_activities_book_id_fkey',
      'social_activities_list_id_fkey',
      'social_activities_review_id_fkey'
    )
      AND confdeltype = 'c'
      AND convalidated
  ),
  5,
  'profile and social activity ownership foreign keys cascade and validate'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM pg_class AS index_relation
    JOIN pg_namespace AS namespace ON namespace.oid = index_relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND index_relation.relname IN (
        'idx_books_status',
        'idx_books_user_id',
        'idx_goals_user_id',
        'idx_profiles_display_name',
        'idx_sessions_book_id',
        'idx_sessions_user_id',
        'idx_social_activities_book',
        'idx_social_activities_created',
        'idx_social_activities_type',
        'idx_social_activities_user',
        'idx_social_activities_list_id_fk',
        'idx_social_activities_review_id_fk'
      )
  ),
  12,
  'all reconciled lookup and relationship indexes exist'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.validate_reading_session_row()',
    'EXECUTE'
  )
  AND NOT has_function_privilege(
    'authenticated',
    'public.validate_reading_session_row()',
    'EXECUTE'
  )
  AND has_function_privilege(
    'service_role',
    'public.validate_reading_session_row()',
    'EXECUTE'
  ),
  'the reading-session trigger helper is backend-only'
);

SELECT * FROM finish();
ROLLBACK;
