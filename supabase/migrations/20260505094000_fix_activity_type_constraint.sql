-- Replace the legacy social activity type constraint with the app's canonical
-- feed event set. This follows 20260505093000_standardize_activity_types.sql,
-- which changed the post trigger to emit `post`.

ALTER TABLE public.social_activities
DROP CONSTRAINT IF EXISTS social_activities_activity_type_check;

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

