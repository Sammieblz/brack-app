BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(14);

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
SELECT row_security_active('public.book_lists', 'book list RLS is active');
SELECT row_security_active('public.reading_import_jobs', 'reading import RLS is active');

SELECT * FROM finish();
ROLLBACK;
