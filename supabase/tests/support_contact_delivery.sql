BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(20);

SELECT has_table(
  'public',
  'support_delivery_requests',
  'support delivery receipts exist'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.support_delivery_requests'::regclass),
  'support delivery receipts have RLS enabled'
);

SELECT has_function(
  'public',
  'claim_support_delivery',
  ARRAY['uuid', 'text', 'text'],
  'the atomic support delivery claim function exists'
);

SELECT has_function(
  'public',
  'complete_support_delivery',
  ARRAY['uuid', 'text', 'text', 'boolean', 'text', 'text'],
  'the support delivery completion function exists'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.claim_support_delivery(uuid,text,text)')),
  'claim_support_delivery is security definer'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.complete_support_delivery(uuid,text,text,boolean,text,text)')),
  'complete_support_delivery is security definer'
);

SELECT ok(
  (
    SELECT 'search_path=pg_catalog, pg_temp' = ANY(COALESCE(proconfig, ARRAY[]::text[]))
    FROM pg_proc
    WHERE oid = to_regprocedure('public.claim_support_delivery(uuid,text,text)')
  ),
  'claim_support_delivery has a fixed safe search path'
);

SELECT ok(
  (
    SELECT 'search_path=pg_catalog, pg_temp' = ANY(COALESCE(proconfig, ARRAY[]::text[]))
    FROM pg_proc
    WHERE oid = to_regprocedure('public.complete_support_delivery(uuid,text,text,boolean,text,text)')
  ),
  'complete_support_delivery has a fixed safe search path'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.claim_support_delivery(uuid,text,text)', 'EXECUTE'),
  'anonymous clients cannot claim deliveries'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.complete_support_delivery(uuid,text,text,boolean,text,text)', 'EXECUTE'),
  'anonymous clients cannot complete deliveries'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.claim_support_delivery(uuid,text,text)', 'EXECUTE'),
  'authenticated clients cannot claim deliveries'
);

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.complete_support_delivery(uuid,text,text,boolean,text,text)', 'EXECUTE'),
  'authenticated clients cannot complete deliveries'
);

SELECT ok(
  has_function_privilege('service_role', 'public.claim_support_delivery(uuid,text,text)', 'EXECUTE'),
  'the service role can claim deliveries'
);

SELECT ok(
  has_function_privilege('service_role', 'public.complete_support_delivery(uuid,text,text,boolean,text,text)', 'EXECUTE'),
  'the service role can complete deliveries'
);

SELECT is(
  public.claim_support_delivery(
    '76000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    repeat('b', 64)
  )->>'state',
  'claimed',
  'a new request is claimed'
);

SELECT is(
  public.claim_support_delivery(
    '76000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    repeat('b', 64)
  )->>'state',
  'in_progress',
  'a concurrent repeat cannot send again'
);

SELECT is(
  public.claim_support_delivery(
    '76000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    repeat('c', 64)
  )->>'state',
  'conflict',
  'a request ID cannot be reused for different content'
);

SELECT ok(
  public.complete_support_delivery(
    '76000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    repeat('b', 64),
    true,
    'provider-message-76',
    NULL
  ),
  'a claimed delivery can be marked accepted'
);

SELECT is(
  public.claim_support_delivery(
    '76000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    repeat('b', 64)
  )->>'state',
  'accepted',
  'an accepted request is idempotent'
);

SELECT hasnt_column(
  'public',
  'support_delivery_requests',
  'message',
  'support message content is not persisted in delivery receipts'
);

SELECT * FROM finish();
ROLLBACK;
