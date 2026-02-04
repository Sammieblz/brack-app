-- Add photo_url column to journal_entries table for photo attachments
ALTER TABLE public.journal_entries
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add index for queries filtering by photo entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_photo_url 
ON public.journal_entries(photo_url) 
WHERE photo_url IS NOT NULL;
