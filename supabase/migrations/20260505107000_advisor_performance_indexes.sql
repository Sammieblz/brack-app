-- Supabase performance advisor follow-up.
-- Cover foreign keys that will be touched by deletes/joins as social,
-- progress, and badge data grows.

CREATE INDEX IF NOT EXISTS idx_posts_user_id
ON public.posts(user_id);

CREATE INDEX IF NOT EXISTS idx_posts_book_id
ON public.posts(book_id)
WHERE book_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_progress_logs_session_id
ON public.progress_logs(session_id)
WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_activities_review_id
ON public.social_activities(review_id)
WHERE review_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_activities_list_id
ON public.social_activities(list_id)
WHERE list_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_activities_badge_id
ON public.social_activities(badge_id)
WHERE badge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id
ON public.user_badges(badge_id);

DROP INDEX IF EXISTS public.idx_journal_entries_user_id_fk;
