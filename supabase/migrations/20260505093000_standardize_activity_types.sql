-- Standardize social activity event names.
-- The frontend feed model uses `post`, while the legacy post trigger emitted
-- `created_post`. Keep the canonical set explicit so future triggers cannot
-- drift from the app contract.

UPDATE public.social_activities
SET activity_type = 'post'
WHERE activity_type = 'created_post';

CREATE OR REPLACE FUNCTION public.create_post_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.social_activities (user_id, activity_type, metadata)
  VALUES (
    NEW.user_id,
    'post',
    jsonb_build_object(
      'post_id', NEW.id,
      'post_title', NEW.title,
      'genre', NEW.genre
    )
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'social_activities_activity_type_check'
      AND conrelid = 'public.social_activities'::regclass
  ) THEN
    ALTER TABLE public.social_activities
    ADD CONSTRAINT social_activities_activity_type_check
    CHECK (
      activity_type IN (
        'book_started',
        'book_completed',
        'book_reviewed',
        'followed_user',
        'created_list',
        'earned_badge',
        'post'
      )
    );
  END IF;
END $$;

