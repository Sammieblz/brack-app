BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(27);

SELECT has_function(
  'public',
  'direct_message_pair_status',
  ARRAY['uuid', 'uuid'],
  'the canonical direct-message eligibility predicate exists'
);

SELECT has_function(
  'public',
  'direct_message_conversation_status',
  ARRAY['uuid', 'uuid'],
  'the conversation eligibility predicate exists'
);

SELECT ok(
  (
    SELECT procedure.prosecdef
      AND 'search_path=""' = ANY(COALESCE(procedure.proconfig, ARRAY[]::TEXT[]))
    FROM pg_proc AS procedure
    WHERE procedure.oid = to_regprocedure('public.direct_message_pair_status(uuid,uuid)')
  ),
  'the pair predicate is security-definer with an empty search path'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.direct_message_pair_status(uuid,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot inspect direct-message eligibility'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.direct_message_pair_status(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated callers cannot inspect arbitrary user pairs'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.current_user_direct_message_pair_status(uuid)',
    'EXECUTE'
  ),
  'authenticated RLS checks can inspect only the caller relationship'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND policyname = 'Users can view messages in their conversations'
      AND cmd = 'SELECT'
  ),
  'existing conversation history remains participant-readable'
);

INSERT INTO auth.users(
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('76000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dm-a@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('76000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dm-b@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('76000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dm-c@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('76000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dm-d@example.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

INSERT INTO public.profiles(id, display_name, profile_visibility)
VALUES
  ('76000000-0000-0000-0000-000000000001', 'DM Reader A', 'public'),
  ('76000000-0000-0000-0000-000000000002', 'DM Reader B', 'public'),
  ('76000000-0000-0000-0000-000000000003', 'DM Reader C', 'public'),
  ('76000000-0000-0000-0000-000000000004', 'DM Reader D', 'public')
ON CONFLICT (id) DO UPDATE
SET profile_visibility = EXCLUDED.profile_visibility;

INSERT INTO public.user_follows(follower_id, following_id)
VALUES ('76000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002');

-- Production intentionally revokes direct inserts from authenticated. Grant
-- them only inside this rolled-back transaction so the RLS policies themselves
-- are exercised in addition to the service-path table triggers.
GRANT SELECT, INSERT ON public.conversations, public.messages TO authenticated;

SELECT is(
  public.direct_message_pair_status(
    '76000000-0000-0000-0000-000000000001',
    '76000000-0000-0000-0000-000000000002'
  ),
  'relationship_required',
  'a one-way follow is not eligible'
);

SELECT set_config('request.jwt.claims', '{"sub":"76000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '76000000-0000-0000-0000-000000000001', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ INSERT INTO public.conversations(id, participant_one_id, participant_two_id)
     VALUES ('76100000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002') $$,
  '42501',
  NULL,
  'RLS and the insert trigger reject a one-way-follow conversation'
);

RESET ROLE;
INSERT INTO public.user_follows(follower_id, following_id)
VALUES ('76000000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000001');

SELECT is(
  public.direct_message_pair_status(
    '76000000-0000-0000-0000-000000000001',
    '76000000-0000-0000-0000-000000000002'
  ),
  'eligible',
  'mutual public readers are eligible'
);

SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$ INSERT INTO public.conversations(id, participant_one_id, participant_two_id)
     VALUES ('76100000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002') $$,
  'a mutual follower can create a direct conversation'
);

SELECT lives_ok(
  $$ INSERT INTO public.messages(id, conversation_id, sender_id, content)
     VALUES ('76200000-0000-0000-0000-000000000001', '76100000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', 'hello') $$,
  'a mutual follower can send a direct message'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.messages WHERE id = '76200000-0000-0000-0000-000000000001'),
  1,
  'the eligible message was stored once'
);

RESET ROLE;
DELETE FROM public.user_follows
WHERE follower_id = '76000000-0000-0000-0000-000000000002'
  AND following_id = '76000000-0000-0000-0000-000000000001';

SELECT is(
  public.direct_message_pair_status(
    '76000000-0000-0000-0000-000000000001',
    '76000000-0000-0000-0000-000000000002'
  ),
  'relationship_required',
  'unfollowing immediately removes send eligibility'
);

SET LOCAL ROLE authenticated;
SELECT results_eq(
  $$ SELECT content FROM public.messages WHERE id = '76200000-0000-0000-0000-000000000001' $$,
  ARRAY['hello'::TEXT],
  'existing text history remains readable after unfollow'
);

SELECT throws_ok(
  $$ INSERT INTO public.messages(conversation_id, sender_id, content)
     VALUES ('76100000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', 'not allowed') $$,
  '42501',
  NULL,
  'authenticated direct-table sends fail after unfollow'
);

RESET ROLE;
SELECT throws_ok(
  $$ INSERT INTO public.messages(conversation_id, sender_id, content)
     VALUES ('76100000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', 'service bypass attempt') $$,
  '42501',
  'Direct messaging is unavailable for this reader.',
  'the trigger also rejects service-role-style inserts after unfollow'
);

INSERT INTO public.user_follows(follower_id, following_id)
VALUES ('76000000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000001');
INSERT INTO public.user_blocks(blocker_id, blocked_id)
VALUES ('76000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002');

SELECT is(
  public.direct_message_pair_status(
    '76000000-0000-0000-0000-000000000001',
    '76000000-0000-0000-0000-000000000002'
  ),
  'restricted',
  'a block overrides cached mutual-follow state'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.user_follows
   WHERE follower_id IN ('76000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002')
     AND following_id IN ('76000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002')),
  0,
  'blocking removes both cached follow directions'
);

SELECT throws_ok(
  $$ INSERT INTO public.messages(conversation_id, sender_id, content)
     VALUES ('76100000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', 'blocked attempt') $$,
  '42501',
  'Direct messaging is unavailable for this reader.',
  'blocked pairs cannot send through privileged API paths'
);

INSERT INTO public.user_follows(follower_id, following_id)
VALUES
  ('76000000-0000-0000-0000-000000000003', '76000000-0000-0000-0000-000000000004'),
  ('76000000-0000-0000-0000-000000000004', '76000000-0000-0000-0000-000000000003');
UPDATE public.profiles
SET profile_visibility = 'private'
WHERE id = '76000000-0000-0000-0000-000000000004';

SELECT is(
  public.direct_message_pair_status(
    '76000000-0000-0000-0000-000000000003',
    '76000000-0000-0000-0000-000000000004'
  ),
  'restricted',
  'a private profile disables direct messaging in both directions'
);

SELECT throws_ok(
  $$ INSERT INTO public.conversations(participant_one_id, participant_two_id)
     VALUES ('76000000-0000-0000-0000-000000000003', '76000000-0000-0000-0000-000000000004') $$,
  '42501',
  'Direct messaging is unavailable for this reader.',
  'private-profile restrictions also apply to privileged creation paths'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'club_chat_messages'
      AND policyname = 'Club members can create chat messages'
  ),
  'club chat retains its independent membership policy'
);

DELETE FROM public.user_blocks
WHERE blocker_id = '76000000-0000-0000-0000-000000000001'
  AND blocked_id = '76000000-0000-0000-0000-000000000002';
INSERT INTO public.user_follows(follower_id, following_id)
VALUES
  ('76000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000002'),
  ('76000000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

SELECT is(
  public.direct_message_conversation_status(
    '76100000-0000-0000-0000-000000000001',
    '76000000-0000-0000-0000-000000000003'
  ),
  'restricted',
  'non-participants cannot gain eligibility for an existing conversation'
);

SELECT lives_ok(
  $$ DELETE FROM public.profiles WHERE id = '76000000-0000-0000-0000-000000000002' $$,
  'account deletion remains allowed and cascades safely'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.conversations WHERE id = '76100000-0000-0000-0000-000000000001'),
  0,
  'account deletion removes the former direct conversation'
);

SELECT is(
  public.direct_message_pair_status(
    '76000000-0000-0000-0000-000000000001',
    '76000000-0000-0000-0000-000000000002'
  ),
  'restricted',
  'deleted accounts cannot regain eligibility from stale identifiers'
);

SELECT * FROM finish();
ROLLBACK;
