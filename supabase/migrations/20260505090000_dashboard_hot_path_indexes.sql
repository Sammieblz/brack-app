-- Dashboard and reading hot-path indexes.
-- These match the current dashboard/library query paths documented in
-- docs/performance/dashboard-query-audit.md and docs/performance/index-audit.md.

CREATE INDEX IF NOT EXISTS idx_books_user_updated_active
ON public.books(user_id, updated_at DESC NULLS LAST, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_progress_logs_user_book_logged_at
ON public.progress_logs(user_id, book_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_progress_logs_user_logged_at
ON public.progress_logs(user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_book_activity_at
ON public.reading_sessions(user_id, book_id, (COALESCE(start_time, created_at)) DESC)
WHERE book_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_activity_at
ON public.reading_sessions(user_id, (COALESCE(start_time, created_at)) DESC);

