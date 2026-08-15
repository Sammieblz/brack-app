BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(9);

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

SELECT * FROM finish();
ROLLBACK;
