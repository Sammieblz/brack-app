-- Reduce the direct PostgREST/GraphQL attack surface.
--
-- Frontend code should enter backend write/read models through the maintained
-- `src/services/api/*` modules and Edge Functions. Backend-only SECURITY
-- DEFINER functions stay callable by `service_role`; direct client RPCs are
-- limited to functions that perform their own auth.uid ownership checks.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Tighten helper functions whose direct result can reveal private club state.
CREATE OR REPLACE FUNCTION public.is_club_member(club_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.book_club_members
    WHERE book_club_members.club_id = is_club_member.club_id
      AND book_club_members.user_id = is_club_member.user_id
      AND (
        auth.uid() IS NULL
        OR auth.uid() = is_club_member.user_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_admin(club_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.book_club_members
    WHERE book_club_members.club_id = is_club_admin.club_id
      AND book_club_members.user_id = is_club_admin.user_id
      AND book_club_members.role = 'admin'
      AND (
        auth.uid() IS NULL
        OR auth.uid() = is_club_admin.user_id
      )
  );
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'add_club_creator_as_admin',
        'add_library_book',
        'award_badges',
        'calculate_distance',
        'complete_reading_transaction',
        'create_badge_activity',
        'create_book_activity',
        'create_follow_activity',
        'create_list_activity',
        'create_post_activity',
        'create_reading_session',
        'create_review_activity',
        'get_dashboard_home_snapshot',
        'get_user_dashboard_stats',
        'handle_new_user',
        'log_progress_transaction',
        'recalculate_user_reading_streak',
        'refresh_dashboard_home_snapshot',
        'refresh_reading_streak_day',
        'sync_profile_streak_from_reading_streak_day',
        'sync_reading_streak_day_from_progress_log',
        'sync_reading_streak_day_from_session',
        'update_conversation_timestamp',
        'update_post_comments_count',
        'update_post_likes_count',
        'update_review_comments_count',
        'update_review_likes_count'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.fn);
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'get_conversation_summaries',
        'is_club_admin',
        'is_club_member',
        'use_reading_streak_freeze'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.fn);
  END LOOP;
END;
$$;

ALTER FUNCTION public.normalize_book_isbn(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.normalize_book_text(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.compute_daily_analytics(uuid, date) SET search_path = public, pg_temp;
