-- Canonical, read-only fingerprint input for migration postflight checks.
-- Keep this query free of data rows: it describes the public schema and the
-- effective API-role access that must be reproducible from the migration ledger.
WITH
public_relations AS (
  SELECT relation.*, namespace.nspname AS schema_name
  FROM pg_class AS relation
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
),
schema_objects(object_type, object_name, definition) AS (
  SELECT
    'relation',
    FORMAT('%I.%I', relation.schema_name, relation.relname),
    jsonb_build_object(
      'kind', relation.relkind,
      'persistence', relation.relpersistence,
      'row_security', relation.relrowsecurity,
      'force_row_security', relation.relforcerowsecurity,
      'replica_identity', relation.relreplident,
      'options', COALESCE(to_jsonb(relation.reloptions), '[]'::jsonb),
      'partition_bound', pg_get_expr(relation.relpartbound, relation.oid, TRUE)
    )::TEXT
  FROM public_relations AS relation
  WHERE relation.relkind IN ('r', 'p', 'v', 'm', 'f')

  UNION ALL

  SELECT
    'column',
    FORMAT('%I.%I.%I', relation.schema_name, relation.relname, attribute.attname),
    jsonb_build_object(
      'position', attribute.attnum,
      'type', format_type(attribute.atttypid, attribute.atttypmod),
      'not_null', attribute.attnotnull,
      'identity', attribute.attidentity,
      'generated', attribute.attgenerated,
      'storage', attribute.attstorage,
      'compression', attribute.attcompression,
      'collation', CASE
        WHEN attribute.attcollation = 0 THEN NULL
        ELSE (SELECT FORMAT('%I.%I', n.nspname, c.collname)
              FROM pg_collation AS c
              JOIN pg_namespace AS n ON n.oid = c.collnamespace
              WHERE c.oid = attribute.attcollation)
      END,
      'default', pg_get_expr(attribute_default.adbin, attribute_default.adrelid, TRUE)
    )::TEXT
  FROM public_relations AS relation
  JOIN pg_attribute AS attribute ON attribute.attrelid = relation.oid
  LEFT JOIN pg_attrdef AS attribute_default
    ON attribute_default.adrelid = attribute.attrelid
   AND attribute_default.adnum = attribute.attnum
  WHERE relation.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped

  UNION ALL

  SELECT
    'constraint',
    FORMAT('%I.%I.%I', relation.schema_name, relation.relname, constraint_state.conname),
    jsonb_build_object(
      'type', constraint_state.contype,
      'definition', pg_get_constraintdef(constraint_state.oid, TRUE),
      'validated', constraint_state.convalidated,
      'deferrable', constraint_state.condeferrable,
      'initially_deferred', constraint_state.condeferred,
      'no_inherit', constraint_state.connoinherit
    )::TEXT
  FROM pg_constraint AS constraint_state
  JOIN public_relations AS relation ON relation.oid = constraint_state.conrelid

  UNION ALL

  SELECT
    'index',
    FORMAT('%I.%I', index_namespace.nspname, index_relation.relname),
    jsonb_build_object(
      'table', FORMAT('%I.%I', table_namespace.nspname, table_relation.relname),
      'definition', pg_get_indexdef(index_state.indexrelid),
      'predicate', pg_get_expr(index_state.indpred, index_state.indrelid, TRUE),
      'unique', index_state.indisunique,
      'primary', index_state.indisprimary,
      'exclusion', index_state.indisexclusion,
      'immediate', index_state.indimmediate,
      'valid', index_state.indisvalid,
      'ready', index_state.indisready,
      'clustered', index_state.indisclustered,
      'replica_identity', index_state.indisreplident,
      'nulls_not_distinct', index_state.indnullsnotdistinct
    )::TEXT
  FROM pg_index AS index_state
  JOIN pg_class AS index_relation ON index_relation.oid = index_state.indexrelid
  JOIN pg_namespace AS index_namespace ON index_namespace.oid = index_relation.relnamespace
  JOIN pg_class AS table_relation ON table_relation.oid = index_state.indrelid
  JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_relation.relnamespace
  WHERE table_namespace.nspname = 'public'

  UNION ALL

  SELECT
    'function',
    FORMAT(
      '%I.%I(%s)',
      namespace.nspname,
      procedure.proname,
      pg_get_function_identity_arguments(procedure.oid)
    ),
    jsonb_build_object(
      'kind', procedure.prokind,
      'definition', replace(
        replace(pg_get_functiondef(procedure.oid), E'\r\n', E'\n'),
        E'\r',
        E'\n'
      ),
      'anon_execute', has_function_privilege('anon', procedure.oid, 'EXECUTE'),
      'authenticated_execute', has_function_privilege('authenticated', procedure.oid, 'EXECUTE'),
      'service_role_execute', has_function_privilege('service_role', procedure.oid, 'EXECUTE')
    )::TEXT
  FROM pg_proc AS procedure
  JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.prokind IN ('f', 'p')

  UNION ALL

  SELECT
    'trigger',
    FORMAT('%I.%I.%I', relation.schema_name, relation.relname, trigger_state.tgname),
    jsonb_build_object(
      'enabled', trigger_state.tgenabled,
      'definition', replace(
        replace(pg_get_triggerdef(trigger_state.oid, TRUE), E'\r\n', E'\n'),
        E'\r',
        E'\n'
      )
    )::TEXT
  FROM pg_trigger AS trigger_state
  JOIN public_relations AS relation ON relation.oid = trigger_state.tgrelid
  WHERE NOT trigger_state.tgisinternal

  UNION ALL

  SELECT
    'policy',
    FORMAT('%I.%I.%I', policy.schemaname, policy.tablename, policy.policyname),
    jsonb_build_object(
      'permissive', policy.permissive,
      'roles', to_jsonb(policy.roles),
      'command', policy.cmd,
      'using', policy.qual,
      'check', policy.with_check
    )::TEXT
  FROM pg_policies AS policy
  WHERE policy.schemaname = 'public'

  UNION ALL

  SELECT
    'sequence',
    FORMAT('%I.%I', namespace.nspname, relation.relname),
    jsonb_build_object(
      'type', format_type(sequence_state.seqtypid, NULL),
      'start', sequence_state.seqstart,
      'increment', sequence_state.seqincrement,
      'minimum', sequence_state.seqmin,
      'maximum', sequence_state.seqmax,
      'cache', sequence_state.seqcache,
      'cycle', sequence_state.seqcycle
    )::TEXT
  FROM pg_sequence AS sequence_state
  JOIN pg_class AS relation ON relation.oid = sequence_state.seqrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'

  UNION ALL

  SELECT
    'enum',
    FORMAT('%I.%I', namespace.nspname, type_state.typname),
    jsonb_build_object(
      'labels', jsonb_agg(enum_state.enumlabel ORDER BY enum_state.enumsortorder)
    )::TEXT
  FROM pg_type AS type_state
  JOIN pg_namespace AS namespace ON namespace.oid = type_state.typnamespace
  JOIN pg_enum AS enum_state ON enum_state.enumtypid = type_state.oid
  WHERE namespace.nspname = 'public'
  GROUP BY namespace.nspname, type_state.typname

  UNION ALL

  SELECT
    'domain',
    FORMAT('%I.%I', namespace.nspname, type_state.typname),
    jsonb_build_object(
      'base_type', format_type(type_state.typbasetype, type_state.typtypmod),
      'not_null', type_state.typnotnull,
      'default', type_state.typdefault,
      'collation', CASE
        WHEN type_state.typcollation = 0 THEN NULL
        ELSE (SELECT FORMAT('%I.%I', n.nspname, c.collname)
              FROM pg_collation AS c
              JOIN pg_namespace AS n ON n.oid = c.collnamespace
              WHERE c.oid = type_state.typcollation)
      END
    )::TEXT
  FROM pg_type AS type_state
  JOIN pg_namespace AS namespace ON namespace.oid = type_state.typnamespace
  WHERE namespace.nspname = 'public'
    AND type_state.typtype = 'd'
)
SELECT object_type, object_name, definition
FROM schema_objects
ORDER BY object_type, object_name;
