-- Preserve journal and goal deletes as tombstones so offline sync can replay
-- deletions across devices.

ALTER TABLE public.journal_entries
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_updated_deleted
ON public.journal_entries(user_id, updated_at DESC, deleted_at);

CREATE INDEX IF NOT EXISTS idx_goals_user_updated_deleted
ON public.goals(user_id, updated_at DESC, deleted_at);

CREATE INDEX IF NOT EXISTS idx_journal_entries_book_active
ON public.journal_entries(book_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_goals_user_active_not_deleted
ON public.goals(user_id, is_active, created_at DESC)
WHERE deleted_at IS NULL;
