-- Fix missing foreign key relationships for underused tables

-- Add foreign key constraint to reading_streak_history
-- This ensures referential integrity and proper cascading
ALTER TABLE public.reading_streak_history
ADD CONSTRAINT reading_streak_history_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Add index for faster queries on reading_streak_history
CREATE INDEX IF NOT EXISTS idx_reading_streak_history_user_achieved 
ON public.reading_streak_history(user_id, achieved_at DESC);

-- Ensure journal_entries has proper foreign key (should already exist, but verify)
-- The foreign key should already exist from migration 20251107195753
-- This is just a verification/comment

-- Add index for journal entries by user and book for better query performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_book 
ON public.journal_entries(user_id, book_id, created_at DESC);

-- Add index for journal entries by entry_type (for quote collection feature)
CREATE INDEX IF NOT EXISTS idx_journal_entries_type 
ON public.journal_entries(entry_type, created_at DESC) 
WHERE entry_type = 'quote';

-- Ensure reading_habits has proper foreign key (should already exist)
-- Add index for reading_habits by genres for recommendation queries
CREATE INDEX IF NOT EXISTS idx_reading_habits_genres 
ON public.reading_habits USING GIN(genres) 
WHERE genres IS NOT NULL;

-- Add composite index for reading_habits user_id and longest_genre for recommendations
CREATE INDEX IF NOT EXISTS idx_reading_habits_user_genre 
ON public.reading_habits(user_id, longest_genre) 
WHERE longest_genre IS NOT NULL;
