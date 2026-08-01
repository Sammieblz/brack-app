-- Capture legacy social-activity trigger objects that exist in the linked
-- project but were never represented in the repository migration chain.
-- Also prevent imported library history from awarding current-install badges
-- or publishing book-status feed activity during the import transition.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.create_badge_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_badge_data RECORD;
BEGIN
  IF NEW.source <> 'earned' THEN
    RETURN NEW;
  END IF;

  SELECT title, description
  INTO v_badge_data
  FROM public.badges
  WHERE id = NEW.badge_id;

  INSERT INTO public.social_activities (
    user_id,
    activity_type,
    badge_id,
    metadata
  )
  VALUES (
    NEW.user_id,
    'earned_badge',
    NEW.badge_id,
    jsonb_build_object(
      'badge_title', v_badge_data.title,
      'badge_description', v_badge_data.description
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_book_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (
    COALESCE(OLD.metadata->>'import_source', '') = ''
    AND COALESCE(NEW.metadata->>'import_source', '') <> ''
  ) OR (
    COALESCE(OLD.source_provider, '') NOT IN ('brack_import', 'goodreads_import')
    AND COALESCE(NEW.source_provider, '') IN ('brack_import', 'goodreads_import')
  )
  THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'reading'
    AND (OLD.status IS NULL OR OLD.status <> 'reading')
  THEN
    INSERT INTO public.social_activities (
      user_id,
      activity_type,
      book_id,
      metadata
    )
    VALUES (
      NEW.user_id,
      'book_started',
      NEW.id,
      jsonb_build_object(
        'book_title', NEW.title,
        'book_author', NEW.author
      )
    );
  END IF;

  IF NEW.status = 'completed'
    AND (OLD.status IS NULL OR OLD.status <> 'completed')
  THEN
    INSERT INTO public.social_activities (
      user_id,
      activity_type,
      book_id,
      metadata
    )
    VALUES (
      NEW.user_id,
      'book_completed',
      NEW.id,
      jsonb_build_object(
        'book_title', NEW.title,
        'book_author', NEW.author
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_follow_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_followed_user_name TEXT;
BEGIN
  SELECT display_name
  INTO v_followed_user_name
  FROM public.profiles
  WHERE id = NEW.following_id;

  INSERT INTO public.social_activities (
    user_id,
    activity_type,
    metadata
  )
  VALUES (
    NEW.follower_id,
    'followed_user',
    jsonb_build_object(
      'followed_user_id', NEW.following_id,
      'followed_user_name', v_followed_user_name
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_list_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.is_public = true THEN
    INSERT INTO public.social_activities (
      user_id,
      activity_type,
      list_id,
      metadata
    )
    VALUES (
      NEW.user_id,
      'created_list',
      NEW.id,
      jsonb_build_object(
        'list_name', NEW.name,
        'list_description', NEW.description
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_review_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_book_data RECORD;
BEGIN
  SELECT title, author
  INTO v_book_data
  FROM public.books
  WHERE id = NEW.book_id;

  INSERT INTO public.social_activities (
    user_id,
    activity_type,
    book_id,
    review_id,
    metadata
  )
  VALUES (
    NEW.user_id,
    'book_reviewed',
    NEW.book_id,
    NEW.id,
    jsonb_build_object(
      'book_title', v_book_data.title,
      'book_author', v_book_data.author,
      'rating', NEW.rating
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_badges_after_domain_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID;
  v_event TEXT;
  v_new JSONB := to_jsonb(NEW);
  v_old JSONB := CASE
    WHEN TG_OP = 'INSERT' THEN '{}'::JSONB
    ELSE to_jsonb(OLD)
  END;
BEGIN
  IF TG_TABLE_NAME = 'books' AND TG_OP = 'INSERT' THEN
    IF COALESCE(v_new #>> '{metadata,import_source}', '') <> ''
      OR COALESCE(v_new->>'source_provider', '') IN (
        'brack_import',
        'goodreads_import'
      )
    THEN
      RETURN NEW;
    END IF;

    v_user_id := (v_new->>'user_id')::UUID;
    v_event := 'book_added';
  ELSIF TG_TABLE_NAME = 'book_lists' AND TG_OP = 'INSERT' THEN
    v_user_id := (v_new->>'user_id')::UUID;
    v_event := 'list_created';
  ELSIF TG_TABLE_NAME = 'book_reviews' AND TG_OP = 'INSERT' THEN
    v_user_id := (v_new->>'user_id')::UUID;
    v_event := 'review_created';
  ELSIF TG_TABLE_NAME = 'goals'
    AND COALESCE((v_new->>'is_completed')::BOOLEAN, false) = true
    AND COALESCE((v_old->>'is_completed')::BOOLEAN, false) = false
  THEN
    v_user_id := (v_new->>'user_id')::UUID;
    v_event := 'goal_completed';
  ELSIF TG_TABLE_NAME = 'user_quest_assignments'
    AND v_new->>'status' = 'completed'
    AND v_old->>'status' IS DISTINCT FROM 'completed'
  THEN
    v_user_id := (v_new->>'user_id')::UUID;
    v_event := 'quest_completed';
  ELSIF TG_TABLE_NAME = 'reader_league_members'
    AND v_new->>'finalized_at' IS NOT NULL
    AND v_old->>'finalized_at' IS NULL
  THEN
    v_user_id := (v_new->>'user_id')::UUID;
    v_event := 'league_finalized';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.award_badges(v_user_id, v_event);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_book_activity_trigger ON public.books;
CREATE TRIGGER create_book_activity_trigger
AFTER UPDATE OF status ON public.books
FOR EACH ROW
EXECUTE FUNCTION public.create_book_activity();

DROP TRIGGER IF EXISTS create_follow_activity_trigger ON public.user_follows;
CREATE TRIGGER create_follow_activity_trigger
AFTER INSERT ON public.user_follows
FOR EACH ROW
EXECUTE FUNCTION public.create_follow_activity();

DROP TRIGGER IF EXISTS create_list_activity_trigger ON public.book_lists;
CREATE TRIGGER create_list_activity_trigger
AFTER INSERT ON public.book_lists
FOR EACH ROW
EXECUTE FUNCTION public.create_list_activity();

DROP TRIGGER IF EXISTS create_review_activity_trigger ON public.book_reviews;
CREATE TRIGGER create_review_activity_trigger
AFTER INSERT ON public.book_reviews
FOR EACH ROW
EXECUTE FUNCTION public.create_review_activity();

DROP TRIGGER IF EXISTS create_badge_activity_trigger ON public.user_badges;
CREATE TRIGGER create_badge_activity_trigger
AFTER INSERT ON public.user_badges
FOR EACH ROW
EXECUTE FUNCTION public.create_badge_activity();

REVOKE ALL ON FUNCTION public.create_book_activity()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_follow_activity()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_list_activity()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_review_activity()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_badge_activity()
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.evaluate_badges_after_domain_event()
FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.evaluate_badges_after_domain_event() IS
  'Evaluates current-install domain events for badges while excluding imported library history.';

COMMIT;
